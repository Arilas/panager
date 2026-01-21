//! macOS system tray setup
//!
//! This module handles setting up the system tray icon and menu for macOS.

use crate::platform::posix::tray::{build_tray_menu, create_tray_builder, show_and_unminimize_main_window};
use tauri::App;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

/// Setup the system tray icon and menu
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app)?;
    let _tray = create_tray_builder(app, &menu).build(app)?;
    Ok(())
}

/// Setup the global keyboard shortcut (Cmd+Shift+O on macOS)
pub fn setup_global_shortcut(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "CommandOrControl+Shift+O".parse().unwrap();
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, _event| {
            show_and_unminimize_main_window(app);
        })?;

    Ok(())
}
