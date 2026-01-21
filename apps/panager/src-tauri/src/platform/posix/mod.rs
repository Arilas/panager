//! POSIX-shared functionality for macOS and Linux
//!
//! This module contains code that works identically on POSIX-compliant
//! systems (macOS and Linux) but differs from Windows. It provides a
//! shared foundation for Unix-like platforms to avoid code duplication.

pub mod filesystem;
pub mod home;
pub mod tray;

pub use filesystem::*;
pub use home::home_dir;
