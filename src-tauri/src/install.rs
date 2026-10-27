// Runs NVIDIA's installer elevated (one UAC prompt) and reports how it went.
use crate::download::verify;
use crate::system::powershell;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub code: Option<i64>,
    pub cancelled: bool,
    pub message: Option<String>,
}

pub fn run(path: &Path, express: bool, clean: bool) -> Result<InstallResult, String> {
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
    let out = powershell(&script)?;
    serde_json::from_str(out.trim()).map_err(|e| format!("Unexpected installer response: {e}"))
}
