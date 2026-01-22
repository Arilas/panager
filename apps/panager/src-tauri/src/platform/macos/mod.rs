//! macOS-specific functionality
//!
//! This module contains macOS-specific code including:
//! - Native menu bar setup
//! - System tray with global shortcuts
//! - Window vibrancy effects
//! - Liquid Glass CSS effects
//! - Editor detection in /Applications
//! - Terminal detection in /Applications
//! - Application lifecycle (window close/reopen behavior)

pub mod editors;
pub mod lifecycle;
pub mod liquid_glass;
pub mod menu;
pub mod terminals;
pub mod tray;
pub mod vibrancy;

pub use menu::*;
pub use tray::*;
pub use vibrancy::*;
