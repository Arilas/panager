//! IDE Command handlers
//!
//! All commands are prefixed with `ide_` to avoid conflicts with main app commands.

pub mod files;
pub mod git;
pub mod lsp;
pub mod plugins;
pub mod recent;
pub mod search;
pub mod session;
pub mod settings;
pub mod tabs;
pub mod watcher;
pub mod window;

pub use files::*;
pub use git::*;
pub use lsp::*;
pub use plugins::*;
pub use recent::*;
pub use search::*;
pub use session::*;
pub use settings::*;
pub use tabs::*;
pub use watcher::*;
pub use window::*;
