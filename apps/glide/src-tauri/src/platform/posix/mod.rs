//! POSIX-shared functionality for macOS and Linux
//!
//! This module contains code that works identically on POSIX-compliant
//! systems (macOS and Linux) but differs from Windows.

pub mod filesystem;
pub mod home;

pub use filesystem::*;
pub use home::home_dir;
