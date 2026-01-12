//! Application lifecycle event handling
//!
//! This module handles window events and application run events.

use tauri::{AppHandle, RunEvent, WindowEvent};

#[cfg(target_os = "macos")]
use tauri::Manager;

/// Handle window events
pub fn handle_window_event(_window: &tauri::Window, _event: &WindowEvent) {
    // On macOS, hide the window instead of closing to keep the app running
    // This allows the global shortcut to still work
    #[cfg(target_os = "macos")]
    if let WindowEvent::CloseRequested { api, .. } = _event {
        let _ = _window.hide();
        api.prevent_close();
    }
}

/// Handle application run events
pub fn handle_run_event(_app: &AppHandle, _event: RunEvent) {
    // Handle dock click on macOS to reopen the window
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen { .. } = _event {
        if let Some(window) = _app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
