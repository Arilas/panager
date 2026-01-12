//! Common tray functionality shared between macOS and Linux
//!
//! This module provides the shared building blocks for system tray setup.
//! Platform-specific modules can use these functions to reduce duplication.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Wry,
};

/// Build the common tray menu with Show and Quit items
pub fn build_tray_menu(app: &App) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit Panager", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Show Panager", true, None::<&str>)?;
    Ok(Menu::with_items(app, &[&show_item, &quit_item])?)
}

/// Create a tray icon builder with common configuration
///
/// Sets up the menu, click handlers, and icon (if available).
/// The icon is optional to handle platforms where it might not be set.
pub fn create_tray_builder(app: &App, menu: &Menu<Wry>) -> TrayIconBuilder<Wry> {
    let mut builder = TrayIconBuilder::new()
        .menu(menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if is_left_click(&event) {
                show_main_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
}

/// Check if a tray event is a left click release
pub fn is_left_click(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
    )
}

/// Show and focus the main window
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Show, unminimize, and focus the main window
pub fn show_and_unminimize_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Handle common menu events (show, quit)
pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "quit" => app.exit(0),
        "show" => show_main_window(app),
        _ => {}
    }
}
