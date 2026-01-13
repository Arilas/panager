//! Linux-specific functionality
//!
//! This module contains Linux-specific code including:
//! - System tray setup for GTK-based desktop environments
//! - Global keyboard shortcuts via X11/Wayland
//! - Editor detection (Flatpak, Snap, AppImage, Toolbox)
//! - Terminal detection (PATH, Flatpak)
//!
//! Note: GNOME Shell requires the "AppIndicator and KStatusNotifierItem Support"
//! extension for system tray icons to be visible.

pub mod editors;
pub mod terminals;
pub mod tray;

pub use tray::*;
