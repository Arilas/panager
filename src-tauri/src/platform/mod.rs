//! Platform-specific functionality
//!
//! This module provides a unified interface for platform-specific operations.
//! It uses a hybrid approach:
//! - **Traits** for complex, multi-method behaviors (editor detection, filesystem ops)
//! - **cfg attributes** for simple one-liners and feature flags
//! - **POSIX module** for shared macOS/Linux code (filesystem permissions, home dir)
//!
//! ## Platform Support
//! - **macOS**: Full support with vibrancy, Liquid Glass, native menus, lifecycle handling
//! - **Linux**: System tray, global shortcuts, editor detection (Flatpak/Snap/AppImage)
//! - **Windows**: Planned, structure ready for implementation

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

/// Unified platform setup function
///
/// Call this from lib.rs during app setup to initialize all platform-specific
/// functionality (tray, shortcuts, vibrancy, menus, etc.).
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        macos::apply_vibrancy_effect(app);
        macos::setup_menu(app)?;
        macos::setup_tray(app)?;
        macos::setup_global_shortcut(app)?;
    }

    #[cfg(target_os = "linux")]
    {
        linux::setup_tray(app)?;
        linux::setup_global_shortcut(app)?;
    }

    #[cfg(target_os = "windows")]
    {
        windows::setup(app)?;
    }

    Ok(())
}
