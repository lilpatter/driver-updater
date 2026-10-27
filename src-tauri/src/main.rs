#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod install;
mod nvidia;
mod settings;
mod system;

use download::Downloads;
use tauri::{AppHandle, State};

fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> impl std::future::Future<Output = Result<T, String>> {
    async move { tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string()) }
}

#[tauri::command]
async fn detect() -> Result<system::Detection, String> {
    blocking(system::detect).await
}

#[tauri::command]
async fn telemetry() -> Result<Option<system::Gpu>, String> {
    blocking(|| system::query_smi().ok().and_then(|g| g.into_iter().next())).await
}

#[tauri::command]
async fn resolve_product(gpu_name: String, notebook: bool) -> Result<Option<nvidia::Product>, String> {
    nvidia::match_product(&gpu_name, notebook).await
}

#[tauri::command]
async fn search_products(query: String) -> Result<Vec<nvidia::Product>, String> {
    nvidia::search_products(&query).await
}

#[tauri::command]
async fn drivers(psid: u32, pfid: u32, windows11: bool, studio: bool, count: u32) -> Result<Vec<nvidia::Driver>, String> {
    nvidia::lookup_drivers(psid, pfid, windows11, studio, count.clamp(1, 40)).await
}

#[tauri::command]
async fn article(url: String) -> nvidia::ArticleMeta {
    nvidia::article_meta(&url).await
}

#[tauri::command]
async fn billboard(url: String) -> Option<String> {
    nvidia::billboard_image(&url).await
}

#[tauri::command]
async fn game_art(name: String) -> nvidia::GameArt {
    nvidia::game_art(&name).await
}

#[tauri::command]
fn download_start(app: AppHandle, state: State<'_, Downloads>, url: String, version: String) -> Result<(), String> {
    download::start(app, &state, url, version)
}

#[tauri::command]
fn download_pause(state: State<'_, Downloads>) {
    download::pause(&state)
}

#[tauri::command]
fn download_cancel(state: State<'_, Downloads>) {
    download::cancel(&state)
}

#[tauri::command]
fn downloads_list(app: AppHandle) -> Result<Vec<download::Installer>, String> {
    download::list(&app)
}

#[tauri::command]
fn download_delete(app: AppHandle, path: String) -> Result<(), String> {
    download::delete_file(&app, &path)
}

#[tauri::command]
fn reveal(app: AppHandle, path: Option<String>) -> Result<(), String> {
    let mut cmd = system::hidden("explorer.exe");
    match path {
        Some(p) => cmd.arg(format!("/select,{}", download::ensure_inside(&app, &p)?.display())),
        None => cmd.arg(download::folder(&app)?),
    };
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn install(app: AppHandle, path: String, express: bool, clean: bool) -> Result<install::InstallResult, String> {
    let p = download::ensure_inside(&app, &path)?;
    blocking(move || install::run(&p, express, clean)).await?
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only https links can be opened.".into());
    }
    system::hidden("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_get(app: AppHandle) -> settings::Settings {
    settings::load(&app)
}

#[tauri::command]
fn settings_set(app: AppHandle, value: settings::Settings) -> Result<(), String> {
    settings::save(&app, &value)
}

fn main() {
    tauri::Builder::default()
        .manage(Downloads::default())
        .invoke_handler(tauri::generate_handler![
            detect,
            telemetry,
            resolve_product,
            search_products,
            drivers,
            article,
            billboard,
            game_art,
            download_start,
            download_pause,
            download_cancel,
            downloads_list,
            download_delete,
            reveal,
            install,
            open_url,
            settings_get,
            settings_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running Driver Updater");
}
