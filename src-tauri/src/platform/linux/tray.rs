//! Linux system tray setup
//!
//! This module handles setting up the system tray icon and menu for Linux.
//! Works with GTK-based desktop environments including GNOME, Xfce, Cinnamon,
//! MATE, and others that support the StatusNotifierItem/AppIndicator protocol.
//!
//! Note: GNOME Shell requires the "AppIndicator and KStatusNotifierItem Support"
//! extension for system tray icons to be visible.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

/// Setup the system tray icon and menu for Linux
///
/// Creates a tray icon with a context menu containing:
/// - Show Panager: Brings the main window to focus
/// - Quit Panager: Exits the application
///
/// Left-clicking the tray icon shows and focuses the main window.
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit Panager", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Show Panager", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu);

    // Handle missing window icon gracefully
    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let _tray = tray_builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// Setup the global keyboard shortcut for Linux
///
/// Registers Ctrl+Shift+O as a global shortcut to show/focus the main window.
/// This works on most Linux desktop environments via X11 or Wayland protocols.
pub fn setup_global_shortcut(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "CommandOrControl+Shift+O"
        .parse()
        .map_err(|e| -> Box<dyn std::error::Error> { Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, e)) })?;
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, _event| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        })?;

    Ok(())
}
