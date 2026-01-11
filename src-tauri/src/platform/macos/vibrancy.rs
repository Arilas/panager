//! macOS vibrancy and Liquid Glass effects
//!
//! This module handles applying visual effects to the window.

use tauri::{App, Manager};

/// Apply vibrancy effect to the main window
pub fn apply_vibrancy_effect(app: &App) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None) {
            eprintln!("Warning: Failed to apply vibrancy: {}", e);
        }

        // Defer Liquid Glass initialization until WebView is ready
        // The WebView is not fully initialized during setup, so we spawn
        // a task that waits briefly then enables Liquid Glass
        let window_clone = window.clone();
        std::thread::spawn(move || {
            // Wait for WebView to be fully initialized
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Err(e) = crate::commands::liquid_glass::enable_liquid_glass_for_window(&window_clone) {
                eprintln!("Warning: Failed to enable Liquid Glass: {}", e);
            }
        });
    }
}
