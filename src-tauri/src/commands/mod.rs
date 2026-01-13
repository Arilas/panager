//! Tauri command handlers
//!
//! This module contains all the Tauri command handlers that are exposed
//! to the frontend via IPC.

pub mod editors;
pub mod git;
pub mod liquid_glass;
pub mod projects;
pub mod scopes;
pub mod settings;
pub mod temp_projects;
pub mod terminal;

// Re-export for convenience
pub use temp_projects as temp;
