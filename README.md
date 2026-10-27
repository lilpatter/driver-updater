# Verdant

A small native Windows app that keeps an NVIDIA GeForce driver up to date. Built with Tauri 2 (Rust + the system WebView2), styled after Apple's Human Interface Guidelines.

## What it does

- Detects your GPU and installed driver (`nvidia-smi`, falling back to WMI) and whether you're on a desktop or laptop.
- Matches the card against NVIDIA's own product catalog and asks NVIDIA's driver service for the latest **Game Ready** and **Studio** releases.
- Downloads installers to `Downloads\NVIDIA Drivers` with progress, pause/resume (HTTP Range) and cancel.
- Checks each installer's Authenticode signature. Only files signed by *NVIDIA Corporation* will be run.
- Installs with one UAC prompt: **Express** (silent, `-s -noreboot -noeula`, optional `-clean`) or **Custom** (NVIDIA's own installer UI). Afterwards it re-reads the active driver to confirm it worked.
- Release history for both channels, with roll back, release notes, and links to NVIDIA's PDF notes.
- Live GPU readings (temperature, load, VRAM, power, clock, fan).
- Search across release notes, plus a manual graphics-card override if detection picks the wrong model.
- Real artwork: Steam key art and headers for the games each driver targets, and NVIDIA's own driver artwork.

## Run

Requires Rust (stable, MSVC) and the WebView2 runtime, which ships with Windows 11.

```bash
cargo run --manifest-path src-tauri/Cargo.toml
```

Release build (single exe at `src-tauri/target/release/verdant.exe`):

```bash
cargo build --release --manifest-path src-tauri/Cargo.toml
```

Optional installer (`.exe` setup via NSIS) with the Tauri CLI:

```bash
cargo install tauri-cli --version "^2" --locked
cargo tauri build
```

## CI

`.github/workflows/build.yml` builds the portable exe and the NSIS setup on Windows and publishes them as a GitHub Release:

- Every push to `main` (or a manual run) publishes `v<version>-build.<run number>`, for example `v1.0.0-build.2`.
- Pushing a tag such as `v1.1.0` publishes a release under that tag.
- Pull requests only build. The files are attached to the run as the `verdant-windows` artifact.

## Self-update

CI builds embed the tag they're published under (`VERDANT_RELEASE_TAG`). On launch and every 6 hours Verdant asks GitHub for the latest release and compares `<version>` and the build number in its tag with its own. If the release is newer, Verdant waits until no driver download or install is running and counts down for 10 seconds. You can choose Later or Update Now. Then it:

1. Downloads `verdant.exe` from the release next to the running exe, as `<exe>.new`, and checks its size and GitHub's SHA-256 digest. A release without a digest, or hosted anywhere but this repository's releases, is refused.
2. Renames the running exe to `<exe>.old`. Windows allows renaming a running exe but not deleting it.
3. Moves `<exe>.new` into its place, starts it with `--updated`, and exits.
4. The new process waits for the old one to exit, deletes `<exe>.old`, opens its window and says which version it updated to.

This works for the portable exe and for the NSIS install, which goes to `%LOCALAPPDATA%` and so needs no admin rights. Local and pull request builds have no tag and never update themselves. You can turn self-update off under Settings › About.

## Layout

```
ui/                 HTML/CSS/JS front end (no build step, no framework)
src-tauri/src/
  main.rs           commands exposed to the UI
  system.rs         GPU, driver and Windows detection
  nvidia.rs         NVIDIA catalog and driver lookups, Steam artwork
  download.rs       resumable downloads and signature checks
  install.rs        elevated install
  selfupdate.rs     updates Verdant itself from GitHub Releases
  settings.rs       settings.json in %APPDATA%\dev.patrick.verdant
```

Not affiliated with NVIDIA. GeForce, Game Ready and Studio are trademarks of NVIDIA Corporation.
