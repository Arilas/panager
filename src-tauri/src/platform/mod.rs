//! Platform-specific functionality
//!
//! This module contains platform-specific code organized by OS.
//!
//! Each platform module provides functionality specific to that operating system:
//!
//! - **macOS**: Vibrancy effects, native menu bar, system tray, Liquid Glass
//! - **Linux**: System tray (GTK/AppIndicator), global shortcuts
//! - **Windows**: (planned) System tray, native notifications

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;
