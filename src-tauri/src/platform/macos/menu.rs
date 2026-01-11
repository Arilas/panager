//! macOS application menu setup
//!
//! This module handles setting up the native macOS menu bar.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    App, Emitter, Manager,
};

/// Setup the macOS application menu bar
pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Panager menu
    let about_item = MenuItem::with_id(app, "about", "About Panager", true, None::<&str>)?;
    let separator_about = PredefinedMenuItem::separator(app)?;
    let settings_item =
        MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let hide = PredefinedMenuItem::hide(app, Some("Hide Panager"))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("Hide Others"))?;
    let show_all = PredefinedMenuItem::show_all(app, Some("Show All"))?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit Panager"))?;

    let app_menu = Submenu::with_items(
        app,
        "Panager",
        true,
        &[
            &about_item,
            &separator_about,
            &settings_item,
            &separator,
            &hide,
            &hide_others,
            &show_all,
            &separator2,
            &quit,
        ],
    )?;

    // Edit menu
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let edit_separator = PredefinedMenuItem::separator(app)?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &edit_separator,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;

    // View menu
    let toggle_sidebar = MenuItem::with_id(
        app,
        "toggle_sidebar",
        "Toggle Sidebar",
        true,
        Some("CmdOrCtrl+B"),
    )?;
    let view_separator = PredefinedMenuItem::separator(app)?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&toggle_sidebar, &view_separator, &fullscreen],
    )?;

    // Window menu
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let window_separator = PredefinedMenuItem::separator(app)?;
    let close_window = PredefinedMenuItem::close_window(app, Some("Close Window"))?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[&minimize, &window_separator, &close_window],
    )?;

    let menu = Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])?;

    app.set_menu(menu)?;

    // Setup menu event handlers
    app.on_menu_event(|app, event| match event.id.as_ref() {
        "about" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("menu-about", ());
            }
        }
        "settings" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("menu-settings", ());
            }
        }
        "toggle_sidebar" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("menu-toggle-sidebar", ());
            }
        }
        _ => {}
    });

    Ok(())
}
