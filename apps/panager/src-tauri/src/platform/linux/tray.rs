//! Linux system tray setup
//!
//! This module handles setting up the system tray icon and menu for Linux.
//! Works with GTK-based desktop environments including GNOME, Xfce, Cinnamon,
//! MATE, and others that support the StatusNotifierItem/AppIndicator protocol.
//!
//! Note: GNOME Shell requires the "AppIndicator and KStatusNotifierItem Support"
//! extension for system tray icons to be visible.

use crate::platform::posix::tray::{build_tray_menu, create_tray_builder, show_and_unminimize_main_window};
use tauri::App;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

/// Setup the system tray icon and menu for Linux
///
/// Creates a tray icon with a context menu containing:
/// - Show Panager: Brings the main window to focus
/// - Quit Panager: Exits the application
///
/// Left-clicking the tray icon shows and focuses the main window.
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app)?;
    let _tray = create_tray_builder(app, &menu).build(app)?;
    Ok(())
}

/// Setup the global keyboard shortcut for Linux (Ctrl+Shift+O)
///
/// This works on most Linux desktop environments via X11 or Wayland protocols.
pub fn setup_global_shortcut(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "CommandOrControl+Shift+O"
        .parse()
        .map_err(|e| -> Box<dyn std::error::Error> {
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, e))
        })?;

    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, _event| {
            show_and_unminimize_main_window(app);
        })?;

    Ok(())
}
