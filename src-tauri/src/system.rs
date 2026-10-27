// Detects the installed NVIDIA GPU, its driver and live telemetry.
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::OnceLock;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Gpu {
    pub name: String,
    pub driver_version: Option<String>,
    pub device_id: Option<String>,
    pub memory_total_mib: Option<f64>,
    pub memory_used_mib: Option<f64>,
    pub temperature_c: Option<f64>,
    pub utilization: Option<f64>,
    pub power_w: Option<f64>,
    pub clock_mhz: Option<f64>,
    pub fan_percent: Option<f64>,
    pub vbios: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os_name: String,
    pub os_build: u32,
    pub is_windows11: bool,
    pub is_notebook: bool,
    pub cpu: String,
    pub driver_date: Option<String>,
    pub computer_name: String,
    pub user_name: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Detection {
    pub system: SystemInfo,
    pub gpu: Option<Gpu>,
}

pub fn hidden(program: &str) -> Command {
    let mut c = Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

pub fn powershell(script: &str) -> Result<String, String> {
    let out = hidden("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn num(s: &str) -> Option<f64> {
    s.trim().parse::<f64>().ok()
}

fn text(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() || t.starts_with('[') { None } else { Some(t.to_string()) }
}

pub fn query_smi() -> Result<Vec<Gpu>, String> {
    let fields = "name,driver_version,pci.device_id,memory.total,memory.used,temperature.gpu,utilization.gpu,power.draw,clocks.gr,fan.speed,vbios_version";
    let out = hidden("nvidia-smi")
        .args([&format!("--query-gpu={fields}"), "--format=csv,noheader,nounits"])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err("nvidia-smi failed".into());
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|line| {
            let c: Vec<&str> = line.split(',').collect();
            let f = |i: usize| c.get(i).copied().unwrap_or("");
            Gpu {
                name: f(0).trim().to_string(),
                driver_version: text(f(1)),
                device_id: text(f(2)),
                memory_total_mib: num(f(3)),
                memory_used_mib: num(f(4)),
                temperature_c: num(f(5)),
                utilization: num(f(6)),
                power_w: num(f(7)),
                clock_mhz: num(f(8)),
                fan_percent: num(f(9)),
                vbios: text(f(10)),
            }
        })
        .collect())
}

// WMI reports e.g. 32.0.16.1742; the last five digits are the NVIDIA version (617.42).
fn wmi_to_nvidia(v: &str) -> Option<String> {
    let digits: String = v.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 5 {
        return None;
    }
    let tail = &digits[digits.len() - 5..];
    Some(format!("{}.{}", &tail[..3], &tail[3..]))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSystem {
    caption: Option<String>,
    build: Option<u32>,
    chassis: Option<Vec<u32>>,
    battery: Option<u32>,
    cpu: Option<String>,
    driver_date: Option<String>,
    gpu_name: Option<String>,
    gpu_driver: Option<String>,
    full_name: Option<String>,
    avatar_path: Option<String>,
}

static SYSTEM: OnceLock<(SystemInfo, Option<(String, String)>)> = OnceLock::new();

fn load_system() -> (SystemInfo, Option<(String, String)>) {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem
$wmi = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' } | Select-Object -First 1
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$pic = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\$sid").Image192
[pscustomobject]@{
  caption = $os.Caption
  build = [int]$os.BuildNumber
  chassis = @((Get-CimInstance Win32_SystemEnclosure).ChassisTypes | ForEach-Object { [int]$_ })
  battery = @(Get-CimInstance Win32_Battery).Count
  cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
  driverDate = if ($wmi) { $wmi.DriverDate.ToString('yyyy-MM-dd') } else { $null }
  gpuName = if ($wmi) { $wmi.Name } else { $null }
  gpuDriver = if ($wmi) { $wmi.DriverVersion } else { $null }
  fullName = (Get-LocalUser -Name $env:USERNAME).FullName
  avatarPath = $pic
} | ConvertTo-Json -Compress
"#;
    let raw: Option<RawSystem> = powershell(script).ok().and_then(|s| serde_json::from_str(s.trim()).ok());
    let computer_name = std::env::var("COMPUTERNAME").unwrap_or_default();
    let user_name = std::env::var("USERNAME").unwrap_or_default();
    let Some(raw) = raw else {
        return (
            SystemInfo { os_name: "Windows".into(), is_windows11: true, computer_name, user_name, ..Default::default() },
            None,
        );
    };
    let portable = [8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32];
    let build = raw.build.unwrap_or(22000);
    let avatar = raw.avatar_path.as_deref().and_then(|p| std::fs::read(p).ok()).map(|bytes| {
        format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))
    });
    let info = SystemInfo {
        os_name: raw.caption.unwrap_or_else(|| "Windows".into()).replace("Microsoft ", ""),
        os_build: build,
        is_windows11: build >= 22000,
        is_notebook: raw.battery.unwrap_or(0) > 0
            || raw.chassis.unwrap_or_default().iter().any(|c| portable.contains(c)),
        cpu: raw.cpu.unwrap_or_default().trim().to_string(),
        driver_date: raw.driver_date,
        computer_name,
        user_name,
        display_name: raw.full_name.filter(|n| !n.trim().is_empty()),
        avatar,
    };
    let wmi_gpu = match (raw.gpu_name, raw.gpu_driver) {
        (Some(n), Some(d)) => Some((n, d)),
        _ => None,
    };
    (info, wmi_gpu)
}

pub fn detect() -> Detection {
    let (system, wmi_gpu) = SYSTEM.get_or_init(load_system).clone();
    let mut system = system;
    let gpu = query_smi().ok().and_then(|g| g.into_iter().next()).or_else(|| {
        wmi_gpu.map(|(name, driver)| Gpu {
            name,
            driver_version: wmi_to_nvidia(&driver),
            device_id: None,
            memory_total_mib: None,
            memory_used_mib: None,
            temperature_c: None,
            utilization: None,
            power_w: None,
            clock_mhz: None,
            fan_percent: None,
            vbios: None,
        })
    });
    if let Some(g) = &gpu {
        if g.name.to_lowercase().contains("laptop") {
            system.is_notebook = true;
        }
    }
    Detection { system, gpu }
}
