//! Folder scanner service
//!
//! This module handles automatic scanning of scope folders for git repositories
//! and tracks projects that are outside their scope's default folder.

mod service;
mod state;

pub use service::*;
pub use state::*;
