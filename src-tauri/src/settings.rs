// Small JSON settings file in the app's config folder.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub channel: String,
    pub auto_check: bool,
    pub check_interval_hours: u32,
    pub express_install: bool,
    pub clean_install: bool,
    pub delete_after_install: bool,
    pub product_override: Option<Value>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            channel: "game-ready".into(),
            auto_check: true,
            check_interval_hours: 6,
            express_install: true,
            clean_install: false,
            delete_after_install: false,
            product_override: None,
        }
    }
}

/// The app was called Driver Updater before; its settings lived under this identifier.
const OLD_IDENTIFIER: &str = "dev.patrick.driverupdater";

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    if !path.exists() {
        if let Some(old) = dir.parent().map(|p| p.join(OLD_IDENTIFIER).join("settings.json")) {
            let _ = std::fs::copy(old, &path);
        }
    }
    Ok(path)
}

pub fn load(app: &AppHandle) -> Settings {
    file(app)
        .ok()
        .and_then(|f| std::fs::read_to_string(f).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(file(app)?, json).map_err(|e| e.to_string())
}
