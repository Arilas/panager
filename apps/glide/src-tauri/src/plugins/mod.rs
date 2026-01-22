//! Plugin System Module
//!
//! This module provides the plugin infrastructure for the IDE, including:
//! - Plugin SDK types and traits
//! - Plugin host for lifecycle management
//! - Plugin context for plugin-to-host communication
//! - Built-in plugins (TypeScript, etc.)
//! - Generic LSP client for language servers

pub mod builtin;
pub mod context;
pub mod host;
pub mod lsp;
pub mod types;

pub use context::PluginContext;
pub use host::PluginHost;
pub use types::*;
