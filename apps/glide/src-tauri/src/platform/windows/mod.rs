//! Windows-specific functionality (placeholder)
//!
//! This module will contain Windows-specific code including:
//! - System tray setup
//! - Global keyboard shortcuts
//! - Editor detection (Program Files, Registry, winget/scoop/chocolatey)
//!
//! ## Planned Features
//! - Native notifications
//! - Mica/Acrylic effects (Windows 11)
//! - Registry-based editor detection

use tauri::App;

/// Unified Windows setup
pub fn setup(_app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // TODO: Implement Windows-specific setup
    // - setup_tray()
    // - setup_global_shortcut()
    Ok(())
}

/// Get the user's home directory on Windows
pub fn home_dir() -> Option<std::path::PathBuf> {
    directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
}
