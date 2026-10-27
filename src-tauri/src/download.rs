// Resumable installer downloads with progress events and Authenticode verification.
use crate::nvidia::UA;
use crate::system::powershell;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

const RUN: u8 = 0;
const PAUSE: u8 = 1;
const CANCEL: u8 = 2;

#[derive(Default)]
pub struct Downloads {
    active: Mutex<Option<Active>>,
}

struct Active {
    version: String,
    flag: Arc<AtomicU8>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    version: String,
    file_name: String,
    received: u64,
    total: u64,
    bytes_per_sec: f64,
    state: &'static str,
    message: Option<String>,
    path: Option<String>,
    signer: Option<String>,
    verified: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Signature {
    pub status: Option<String>,
    pub signer: Option<String>,
}

impl Signature {
    pub fn trusted(&self) -> bool {
        self.status.as_deref() == Some("Valid") && self.signer.as_deref().unwrap_or("").contains("NVIDIA Corporation")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installer {
    pub file_name: String,
    pub path: String,
    pub version: Option<String>,
    pub size: u64,
    pub modified: u64,
    pub partial: bool,
    pub url: Option<String>,
}

fn dl_client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(UA)
            .connect_timeout(Duration::from_secs(20))
            .read_timeout(Duration::from_secs(60))
            .build()
            .expect("download client")
    })
}

pub fn folder(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?.join("NVIDIA Drivers");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn ensure_inside(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let dir = folder(app)?.canonicalize().map_err(|e| e.to_string())?;
    let p = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    if p.parent() != Some(dir.as_path()) {
        return Err("That file is not in the NVIDIA Drivers download folder.".into());
    }
    // canonicalize() yields \\?\ paths, which explorer and Start-Process handle poorly.
    Ok(folder(app)?.join(p.file_name().unwrap_or_default()))
}

fn version_of(file_name: &str) -> Option<String> {
    let v: String = file_name.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    if v.contains('.') { Some(v.trim_end_matches('.').to_string()) } else { None }
}

fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

pub fn verify(path: &Path) -> Signature {
    let script = format!(
        "$s = Get-AuthenticodeSignature -LiteralPath {}; [pscustomobject]@{{ status = [string]$s.Status; signer = if ($s.SignerCertificate) {{ $s.SignerCertificate.Subject }} else {{ $null }} }} | ConvertTo-Json -Compress",
        ps_quote(&path.to_string_lossy())
    );
    powershell(&script)
        .ok()
        .and_then(|o| serde_json::from_str(o.trim()).ok())
        .unwrap_or(Signature { status: None, signer: None })
}

pub fn start(app: AppHandle, state: &Downloads, url: String, version: String) -> Result<(), String> {
    if !url.starts_with("https://") || !url.contains(".nvidia.com/") {
        return Err("Only NVIDIA download links are allowed.".into());
    }
    let flag = {
        let mut active = state.active.lock().unwrap();
        if let Some(a) = active.as_ref() {
            if a.version != version {
                return Err(format!("Driver {} is already downloading.", a.version));
            }
            a.flag.store(RUN, Ordering::SeqCst);
            return Ok(());
        }
        let flag = Arc::new(AtomicU8::new(RUN));
        *active = Some(Active { version: version.clone(), flag: flag.clone() });
        flag
    };
    let dir = folder(&app)?;
    let file_name = url.rsplit('/').next().unwrap_or("driver.exe").to_string();
    tauri::async_runtime::spawn(async move {
        let result = run(&app, &dir, &url, &version, &file_name, flag).await;
        if let Some(state) = app.try_state::<Downloads>() {
            *state.active.lock().unwrap() = None;
        }
        if let Err(message) = result {
            let _ = app.emit("download", Progress {
                version, file_name, received: 0, total: 0, bytes_per_sec: 0.0,
                state: "error", message: Some(message), path: None, signer: None, verified: None,
            });
        }
    });
    Ok(())
}

async fn run(app: &AppHandle, dir: &Path, url: &str, version: &str, file_name: &str, flag: Arc<AtomicU8>) -> Result<(), String> {
    let final_path = dir.join(file_name);
    let part_path = dir.join(format!("{file_name}.part"));
    let base = Progress {
        version: version.into(), file_name: file_name.into(), received: 0, total: 0, bytes_per_sec: 0.0,
        state: "downloading", message: None, path: None, signer: None, verified: None,
    };
    let emit = |p: Progress| { let _ = app.emit("download", p); };

    if !final_path.exists() {
        let mut have = tokio::fs::metadata(&part_path).await.map(|m| m.len()).unwrap_or(0);
        let mut req = dl_client().get(url);
        if have > 0 {
            req = req.header("Range", format!("bytes={have}-"));
        }
        let res = req.send().await.map_err(|e| format!("Couldn't reach NVIDIA: {e}"))?;
        let status = res.status().as_u16();
        if status != 200 && status != 206 {
            return Err(format!("NVIDIA's server answered with HTTP {status}."));
        }
        if status == 200 {
            have = 0;
        }
        let total = have + res.content_length().unwrap_or(0);
        let mut file = tokio::fs::OpenOptions::new()
            .create(true).write(true).append(status == 206).truncate(status == 200)
            .open(&part_path).await.map_err(|e| e.to_string())?;
        let mut stream = res.bytes_stream();
        let mut received = have;
        let mut last_emit = Instant::now();
        let mut window_start = Instant::now();
        let mut window_bytes = 0u64;
        let mut speed = 0.0f64;
        emit(Progress { received, total, ..base.clone() });

        while let Some(chunk) = stream.next().await {
            match flag.load(Ordering::SeqCst) {
                PAUSE => {
                    file.flush().await.ok();
                    emit(Progress { received, total, state: "paused", ..base.clone() });
                    return Ok(());
                }
                CANCEL => {
                    drop(file);
                    let _ = tokio::fs::remove_file(&part_path).await;
                    emit(Progress { state: "cancelled", ..base.clone() });
                    return Ok(());
                }
                _ => {}
            }
            let chunk = chunk.map_err(|e| { format!("The download was interrupted ({e}). You can resume it.") })?;
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            received += chunk.len() as u64;
            window_bytes += chunk.len() as u64;
            let elapsed = window_start.elapsed().as_secs_f64();
            if elapsed >= 0.5 {
                let instant = window_bytes as f64 / elapsed;
                speed = if speed == 0.0 { instant } else { speed * 0.7 + instant * 0.3 };
                window_start = Instant::now();
                window_bytes = 0;
            }
            if last_emit.elapsed() >= Duration::from_millis(200) {
                emit(Progress { received, total, bytes_per_sec: speed, ..base.clone() });
                last_emit = Instant::now();
            }
        }
        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);
        if total > 0 && received < total {
            return Err("The download ended early. You can resume it.".into());
        }
        tokio::fs::rename(&part_path, &final_path).await.map_err(|e| e.to_string())?;
    }

    let size = tokio::fs::metadata(&final_path).await.map(|m| m.len()).unwrap_or(0);
    emit(Progress { received: size, total: size, state: "verifying", ..base.clone() });
    let check_path = final_path.clone();
    let sig = tauri::async_runtime::spawn_blocking(move || verify(&check_path)).await.map_err(|e| e.to_string())?;
    emit(Progress {
        received: size,
        total: size,
        state: "done",
        path: Some(final_path.to_string_lossy().into()),
        verified: Some(sig.trusted()),
        signer: sig.signer.clone(),
        ..base
    });
    Ok(())
}

pub fn set_flag(state: &Downloads, value: u8) {
    if let Some(a) = state.active.lock().unwrap().as_ref() {
        a.flag.store(value, Ordering::SeqCst);
    }
}

pub fn pause(state: &Downloads) { set_flag(state, PAUSE) }
pub fn cancel(state: &Downloads) { set_flag(state, CANCEL) }

pub fn delete_file(app: &AppHandle, path: &str) -> Result<(), String> {
    let p = ensure_inside(app, path)?;
    std::fs::remove_file(p).map_err(|e| e.to_string())
}

pub fn list(app: &AppHandle) -> Result<Vec<Installer>, String> {
    let dir = folder(app)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let partial = name.ends_with(".exe.part");
        if !(name.ends_with(".exe") || partial) {
            continue;
        }
        let meta = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        let version = version_of(&name);
        let exe_name = name.trim_end_matches(".part").to_string();
        out.push(Installer {
            url: version.as_ref().map(|v| format!("https://us.download.nvidia.com/Windows/{v}/{exe_name}")),
            file_name: exe_name,
            path: entry.path().to_string_lossy().into(),
            version,
            size: meta.len(),
            modified: meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0),
            partial,
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}
