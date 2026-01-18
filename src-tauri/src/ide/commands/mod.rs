//! IDE Command handlers
//!
//! All commands are prefixed with `ide_` to avoid conflicts with main app commands.

pub mod files;
pub mod git;
pub mod lsp;
pub mod plugins;
pub mod search;
pub mod watcher;
pub mod window;

pub use files::*;
pub use git::*;
pub use lsp::*;
pub use plugins::*;
pub use search::*;
pub use watcher::*;
pub use window::*;
