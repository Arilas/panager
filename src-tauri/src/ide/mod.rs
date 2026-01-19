//! IDE Module - Provides file viewing and editing capabilities in a separate window
//!
//! This module is intentionally isolated from the main application commands
//! to keep the codebase modular and maintainable.

pub mod commands;
pub mod settings;
pub mod types;
pub mod watcher;

pub use commands::*;
pub use settings::*;
pub use types::*;
