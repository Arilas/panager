//! Application lifecycle event handling
//!
//! This module handles window events and application run events.
//! Platform-specific behavior is delegated to the platform modules.

use tauri::{AppHandle, RunEvent, WindowEvent};

/// Handle window events
///
/// On macOS, windows are hidden instead of closed to keep the app in the dock.
/// On Linux and Windows, the default close behavior (quit app) is used.
#[allow(unused_variables)]
pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    #[cfg(target_os = "macos")]
    if let WindowEvent::CloseRequested { api, .. } = event {
        use crate::platform::macos::lifecycle;
        if lifecycle::should_prevent_close() {
            lifecycle::handle_close(window);
            api.prevent_close();
        }
    }
}

/// Handle application run events
///
/// On macOS, clicking the dock icon reopens the main window.
#[allow(unused_variables)]
pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen { .. } = event {
        crate::platform::macos::lifecycle::handle_reopen(app);
    }
}
