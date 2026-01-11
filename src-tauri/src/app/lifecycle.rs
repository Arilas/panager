//! Application lifecycle event handling
//!
//! This module handles window events and application run events.

use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

/// Handle window events
pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    // On macOS, hide the window instead of closing to keep the app running
    // This allows the global shortcut to still work
    #[cfg(target_os = "macos")]
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
    }
}

/// Handle application run events
pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    // Handle dock click on macOS to reopen the window
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen { .. } = event {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
