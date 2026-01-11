//! Linux-specific functionality
//!
//! This module contains Linux-specific code including system tray setup.
//! Linux does not have macOS-style vibrancy or global menu bars, but
//! we provide system tray functionality that works with GTK-based
//! desktop environments (GNOME, Xfce, Cinnamon, etc.).

pub mod tray;

pub use tray::*;
