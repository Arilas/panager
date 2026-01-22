//! Platform-specific functionality for Glide
//!
//! This module provides platform-specific operations, primarily vibrancy effects.

pub mod capabilities;
pub mod traits;

#[cfg(unix)]
pub mod posix;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

#[cfg(target_os = "windows")]
pub mod windows;

/// Platform setup for Glide
///
/// Applies vibrancy effects on macOS.
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        macos::apply_vibrancy_effect(app);
    }

    // Linux and Windows: no special setup needed for now
    #[cfg(not(target_os = "macos"))]
    let _ = app;

    Ok(())
}
