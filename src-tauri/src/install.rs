// Runs NVIDIA's installer elevated (one UAC prompt) and reports how it went.
//
// The silent installer has no progress API, so progress comes from what it leaves behind:
// the folder it unpacks into under C:\Windows\Temp, then NVIDIA's own setup log in
// %TEMP%\NvidiaLogging, which records the same step counter its installer window uses.
use crate::download::verify;
use crate::system::powershell;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub code: Option<i64>,
    pub cancelled: bool,
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Progress {
    /// permission | unpacking | <NVIDIA stepper name, e.g. InstallChecking, InstallProgress>
    stage: String,
    done_units: u64,
    total_units: u64,
    package: Option<String>,
    phase: Option<String>,
    unpacked_bytes: u64,
    elapsed_secs: u64,
}

pub fn run(app: &AppHandle, path: &Path, express: bool, clean: bool) -> Result<InstallResult, String> {
    let sig = verify(path);
    if !sig.trusted() {
        return Err(format!(
            "This installer isn't signed by NVIDIA Corporation (signature: {}). It won't be run.",
            sig.status.unwrap_or_else(|| "unknown".into())
        ));
    }
    // The package is a self-extractor that forwards these switches to NVIDIA's setup.exe.
    let mut args = Vec::new();
    if express {
        args.extend(["'-s'", "'-noreboot'", "'-noeula'"]);
        if clean {
            args.push("'-clean'");
        }
    }
    let arg_list = if args.is_empty() { String::new() } else { format!("-ArgumentList {}", args.join(",")) };
    let file = path.to_string_lossy().replace('\'', "''");
    let script = format!(
        "try {{ $p = Start-Process -FilePath '{file}' {arg_list} -Verb RunAs -Wait -PassThru -ErrorAction Stop; \
         [pscustomobject]@{{ code = $p.ExitCode; cancelled = $false; message = $null }} | ConvertTo-Json -Compress }} \
         catch {{ [pscustomobject]@{{ code = $null; cancelled = ($_.Exception.Message -match 'cancel'); message = $_.Exception.Message }} | ConvertTo-Json -Compress }}"
    );

    let stop = Arc::new(AtomicBool::new(false));
    let watcher = {
        let (app, stop) = (app.clone(), stop.clone());
        std::thread::spawn(move || watch(app, stop))
    };
    let out = powershell(&script);
    stop.store(true, Ordering::SeqCst);
    let _ = watcher.join();
    serde_json::from_str(out?.trim()).map_err(|e| format!("Unexpected installer response: {e}"))
}

fn watch(app: AppHandle, stop: Arc<AtomicBool>) {
    let mut tracker = Tracker::new();
    while !stop.load(Ordering::SeqCst) {
        tracker.tick();
        let _ = app.emit("install-progress", tracker.progress.clone());
        std::thread::sleep(Duration::from_millis(700));
    }
}

struct Tracker {
    since: SystemTime,
    started: Instant,
    log: Option<PathBuf>,
    offset: u64,
    carry: String,
    unpack_dir: Option<PathBuf>,
    last_size_check: Option<Instant>,
    progress: Progress,
    re_present: Regex,
    re_total: Regex,
    re_step: Regex,
    re_package: Regex,
    re_phase: Regex,
}

impl Tracker {
    fn new() -> Self {
        Self {
            // Small allowance for clock granularity on file timestamps.
            since: SystemTime::now() - Duration::from_secs(5),
            started: Instant::now(),
            log: None,
            offset: 0,
            carry: String::new(),
            unpack_dir: None,
            last_size_check: None,
            progress: Progress { stage: "permission".into(), ..Default::default() },
            re_present: Regex::new(r#"Presenting "!(\w+)""#).unwrap(),
            re_total: Regex::new(r"Estimated total progress amount of (\d+)").unwrap(),
            re_step: Regex::new(r"Moving progress to (\d+) \+ (\d+)").unwrap(),
            re_package: Regex::new(r#"Entering Checkpoint: Processing Package "([^"]+)""#).unwrap(),
            re_phase: Regex::new(r#"Entering Checkpoint: Processing package phase "([^"]+)""#).unwrap(),
        }
    }

    fn tick(&mut self) {
        self.progress.elapsed_secs = self.started.elapsed().as_secs();
        if self.log.is_none() {
            self.log = newest(&std::env::temp_dir().join("NvidiaLogging"), self.since, |name| {
                name.starts_with("Log.") && name.ends_with("setup.exe.log")
            });
        }
        if let Some(log) = self.log.clone() {
            if self.progress.stage == "permission" || self.progress.stage == "unpacking" {
                self.progress.stage = "Install".into();
            }
            self.read_log(&log);
            return;
        }
        // Before setup.exe starts logging, the package is unpacking itself into C:\Windows\Temp\<guid>.
        if self.unpack_dir.is_none() {
            let temp = PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into())).join("Temp");
            self.unpack_dir = newest(&temp, self.since, |name| name.len() == 36 && name.matches('-').count() == 4);
        }
        if let Some(dir) = &self.unpack_dir {
            self.progress.stage = "unpacking".into();
            if self.last_size_check.map_or(true, |t| t.elapsed() >= Duration::from_millis(1500)) {
                self.progress.unpacked_bytes = dir_size(dir);
                self.last_size_check = Some(Instant::now());
            }
        }
    }

    fn read_log(&mut self, log: &Path) {
        // std opens with full sharing, so this works while setup.exe holds the log open.
        let Ok(mut file) = std::fs::File::open(log) else { return };
        if file.seek(SeekFrom::Start(self.offset)).is_err() {
            return;
        }
        let mut bytes = Vec::new();
        if file.read_to_end(&mut bytes).is_err() || bytes.is_empty() {
            return;
        }
        self.offset += bytes.len() as u64;
        let text = std::mem::take(&mut self.carry) + &String::from_utf8_lossy(&bytes).replace('\0', "");
        let mut lines: Vec<&str> = text.split('\n').collect();
        let partial = lines.pop().unwrap_or("").to_string();
        for line in lines {
            self.parse(line);
        }
        self.carry = partial;
    }

    fn parse(&mut self, line: &str) {
        let p = &mut self.progress;
        if let Some(c) = self.re_present.captures(line) {
            p.stage = c[1].to_string();
        } else if let Some(c) = self.re_total.captures(line) {
            p.total_units = c[1].parse().unwrap_or(0);
        } else if let Some(c) = self.re_step.captures(line) {
            let done = c[1].parse::<u64>().unwrap_or(0) + c[2].parse::<u64>().unwrap_or(0);
            p.done_units = p.done_units.max(done);
        } else if let Some(c) = self.re_package.captures(line) {
            p.package = Some(c[1].to_string());
            p.phase = None;
        } else if let Some(c) = self.re_phase.captures(line) {
            p.phase = Some(c[1].to_string());
        }
    }
}

fn newest(dir: &Path, since: SystemTime, accept: impl Fn(&str) -> bool) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|e| accept(&e.file_name().to_string_lossy()))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let stamp = meta.created().or_else(|_| meta.modified()).ok()?;
            (stamp >= since).then_some((stamp, e.path()))
        })
        .max_by_key(|(stamp, _)| *stamp)
        .map(|(_, path)| path)
}

fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else { return 0 };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => dir_size(&e.path()),
            Ok(_) => e.metadata().map(|m| m.len()).unwrap_or(0),
            Err(_) => 0,
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Lines copied from a real 621.01 express install log.
    #[test]
    fn parses_nvidia_setup_log() {
        let mut t = Tracker::new();
        for line in [
            r#"     61.376 |    DEBUG: [NVI2.NVInstaller] 1849@CNVInstaller::InternalCalculate : Estimated total progress amount of 2809. "#,
            r#"     61.376 |    DEBUG: [NVI2.Installation] 107@CInstallationStepper::Present : Presenting "!InstallProgress". "#,
            r#"     61.503 |     INFO: [NVI2.NVInstaller] 3009@CNVInstaller::InternalPerformInstallPackagePhases : Entering Checkpoint: Processing Package "Display.Driver". "#,
            r#"     61.515 |     INFO: [NVI2.NVInstaller] 274@CNVInstaller::StepProgress : Moving progress to 12 + 63 (from request 63 of 63 ). "#,
            r#"     61.544 |     INFO: [NVI2.NVInstaller] 3009@CNVInstaller::InternalPerformInstallPackagePhases : Entering Checkpoint: Processing package phase "installAllDrivers". "#,
            r#"     61.544 |     INFO: [NVI2.NVInstaller] 274@CNVInstaller::StepProgress : Moving progress to 132 + 160 (from request 160 of 160 ). "#,
        ] {
            t.parse(line);
        }
        assert_eq!(t.progress.stage, "InstallProgress");
        assert_eq!(t.progress.total_units, 2809);
        assert_eq!(t.progress.done_units, 292);
        assert_eq!(t.progress.package.as_deref(), Some("Display.Driver"));
        assert_eq!(t.progress.phase.as_deref(), Some("installAllDrivers"));
    }
}
