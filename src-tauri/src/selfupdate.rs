// Updates Verdant itself from the GitHub releases that CI publishes.
//
// Windows won't delete a running exe but it will rename one. So the swap is: download the new
// exe next to the current one, move the running exe aside to <name>.old, move the new one into
// its place, start it and exit. The new process deletes <name>.old once the old one has gone.
use crate::nvidia::UA;
use futures_util::StreamExt;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const LATEST: &str = "https://api.github.com/repos/lilpatter/verdant/releases/latest";
const ASSET: &str = "verdant.exe";
/// Passed to the relaunched exe so it waits for the old process before opening its window.
pub const UPDATED_ARG: &str = "--updated";
/// CI sets this to the run number. Local builds have none and never update themselves.
const BUILD: Option<&str> = option_env!("VERDANT_BUILD");

static BUSY: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub version: String,
    pub build: Option<u64>,
    pub latest: Option<Release>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub tag: String,
    pub name: String,
    pub url: String,
    pub size: u64,
    pub newer: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    state: &'static str,
    received: u64,
    total: u64,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize, Clone)]
struct GhAsset {
    name: String,
    size: u64,
    browser_download_url: String,
    /// "sha256:<hex>", filled in by GitHub for every uploaded asset.
    digest: Option<String>,
}

fn client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(UA)
            .connect_timeout(Duration::from_secs(20))
            .read_timeout(Duration::from_secs(60))
            .build()
            .expect("update client")
    })
}

fn build() -> Option<u64> {
    BUILD.and_then(|b| b.parse().ok())
}

/// v1.2.0 → (1, 2, 0, 0); v1.2.0-build.7 → (1, 2, 0, 7).
fn parse_tag(tag: &str) -> Option<(u64, u64, u64, u64)> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"^v?(\d+)\.(\d+)\.(\d+)(?:-build\.(\d+))?$").unwrap());
    let c = re.captures(tag.trim())?;
    let n = |i: usize| c.get(i).map_or(Some(0), |m| m.as_str().parse().ok());
    Some((n(1)?, n(2)?, n(3)?, n(4)?))
}

fn current(app: &AppHandle) -> Option<(u64, u64, u64, u64)> {
    let v = &app.package_info().version;
    Some((v.major, v.minor, v.patch, build()?))
}

async fn latest() -> Result<(GhRelease, GhAsset), String> {
    let res = client()
        .get(LATEST)
        .header("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("Couldn't reach GitHub: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("GitHub answered with HTTP {}.", res.status().as_u16()));
    }
    let rel: GhRelease = res.json().await.map_err(|e| format!("Unexpected answer from GitHub: {e}"))?;
    let asset = rel.assets.iter().find(|a| a.name == ASSET).cloned().ok_or("The latest release has no verdant.exe.")?;
    Ok((rel, asset))
}

fn newer(app: &AppHandle, tag: &str) -> bool {
    matches!((parse_tag(tag), current(app)), (Some(l), Some(c)) if l > c)
}

pub async fn check(app: &AppHandle) -> Result<Status, String> {
    let mut status = Status { version: app.package_info().version.to_string(), build: build(), latest: None };
    if status.build.is_none() {
        return Ok(status);
    }
    let (rel, asset) = latest().await?;
    status.latest = Some(Release {
        newer: newer(app, &rel.tag_name),
        name: rel.name.unwrap_or_else(|| rel.tag_name.clone()),
        tag: rel.tag_name,
        url: rel.html_url,
        size: asset.size,
    });
    Ok(status)
}

fn sibling(exe: &Path, suffix: &str) -> PathBuf {
    let mut name = exe.file_name().unwrap_or_default().to_os_string();
    name.push(suffix);
    exe.with_file_name(name)
}

/// Downloads the latest release, swaps it in and relaunches. Only returns on failure.
pub async fn install(app: &AppHandle) -> Result<(), String> {
    if BUSY.swap(true, Ordering::SeqCst) {
        return Err("An update is already in progress.".into());
    }
    let result = install_inner(app).await;
    BUSY.store(false, Ordering::SeqCst);
    result
}

async fn install_inner(app: &AppHandle) -> Result<(), String> {
    if build().is_none() {
        return Err("This is a local build, so it doesn't update itself.".into());
    }
    let (rel, asset) = latest().await?;
    if !newer(app, &rel.tag_name) {
        return Err("Verdant is already up to date.".into());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let staged = sibling(&exe, ".new");
    if let Err(e) = download(app, &asset, &staged).await {
        let _ = tokio::fs::remove_file(&staged).await;
        return Err(e);
    }
    let _ = app.emit("self-update", Progress { state: "restarting", received: asset.size, total: asset.size });
    swap(&exe, &staged)?;
    app.exit(0);
    Ok(())
}

async fn download(app: &AppHandle, asset: &GhAsset, to: &Path) -> Result<(), String> {
    let res = client().get(&asset.browser_download_url).send().await.map_err(|e| format!("Couldn't download the update: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("GitHub answered with HTTP {} for the update.", res.status().as_u16()));
    }
    let mut file = tokio::fs::File::create(to).await.map_err(|e| format!("Can't write next to Verdant.exe ({e})."))?;
    let mut hasher = Sha256::new();
    let mut stream = res.bytes_stream();
    let mut received = 0u64;
    let mut head: Vec<u8> = Vec::with_capacity(2);
    let mut last_emit = Instant::now();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("The update download was interrupted ({e})."))?;
        if head.len() < 2 {
            head.extend(chunk.iter().take(2 - head.len()));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if last_emit.elapsed() >= Duration::from_millis(150) {
            let _ = app.emit("self-update", Progress { state: "downloading", received, total: asset.size });
            last_emit = Instant::now();
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    if received != asset.size {
        return Err(format!("The update download was incomplete ({received} of {} bytes).", asset.size));
    }
    if head != b"MZ" {
        return Err("The downloaded update isn't a Windows program.".into());
    }
    let hash: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    if let Some(expected) = asset.digest.as_deref().and_then(|d| d.strip_prefix("sha256:")) {
        if !expected.eq_ignore_ascii_case(&hash) {
            return Err("The downloaded update doesn't match GitHub's checksum. Nothing was changed.".into());
        }
    }
    Ok(())
}

fn swap(exe: &Path, staged: &Path) -> Result<(), String> {
    let old = sibling(exe, ".old");
    let _ = std::fs::remove_file(&old);
    std::fs::rename(exe, &old).map_err(|e| format!("Couldn't move the running Verdant aside ({e})."))?;
    let restore = |err: String| {
        let _ = std::fs::remove_file(exe);
        let _ = std::fs::rename(&old, exe);
        let _ = std::fs::remove_file(staged);
        err
    };
    std::fs::rename(staged, exe).map_err(|e| restore(format!("Couldn't put the new Verdant in place ({e}).")))?;
    std::process::Command::new(exe)
        .arg(UPDATED_ARG)
        .spawn()
        .map_err(|e| restore(format!("Couldn't start the new Verdant ({e}).")))?;
    Ok(())
}

/// Removes what an earlier update left behind. After a relaunch the old process may still be
/// shutting down, and its exe can only be deleted once it has, so wait for that (briefly)
/// before the new window starts up alongside it.
pub fn cleanup() {
    let Ok(exe) = std::env::current_exe() else { return };
    let _ = std::fs::remove_file(sibling(&exe, ".new"));
    let old = sibling(&exe, ".old");
    let tries = if std::env::args().any(|a| a == UPDATED_ARG) { 40 } else { 1 };
    for _ in 0..tries {
        match std::fs::remove_file(&old) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => std::thread::sleep(Duration::from_millis(250)),
            _ => return,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orders_release_tags() {
        assert_eq!(parse_tag("v1.0.0-build.5"), Some((1, 0, 0, 5)));
        assert_eq!(parse_tag("v1.2.0"), Some((1, 2, 0, 0)));
        assert_eq!(parse_tag("1.2.3-beta"), None);
        assert!(parse_tag("v1.0.0-build.10") > parse_tag("v1.0.0-build.9"));
        assert!(parse_tag("v1.1.0") > parse_tag("v1.0.0-build.40"));
    }
}
