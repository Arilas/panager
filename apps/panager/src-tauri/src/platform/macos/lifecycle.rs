//! macOS application lifecycle handling
//!
//! macOS has specific conventions for window management:
//! - Closing a window should hide it, not quit the app (keeps dock icon active)
//! - Clicking the dock icon should reopen the window
//! - This allows global shortcuts to work even when the window is hidden

use tauri::Manager;

/// Handle window close request on macOS
///
/// Returns true to indicate the close should be prevented.
/// The window is hidden instead of closed.
pub fn should_prevent_close() -> bool {
    true
}

/// Hide the window instead of closing it
pub fn handle_close(window: &tauri::Window) {
    let _ = window.hide();
}

/// Handle dock click to reopen the window
pub fn handle_reopen(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
