//! Plugin registration for Tauri
//!
//! This module handles registering all Tauri plugins used by the application.

use tauri::Wry;

/// Register all plugins with the Tauri builder
pub fn register_plugins(builder: tauri::Builder<Wry>) -> tauri::Builder<Wry> {
    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
}
