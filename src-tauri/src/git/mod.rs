//! Git functionality for Panager
//!
//! This module consolidates all git-related functionality including:
//! - Git status operations
//! - Git configuration management
//! - Git identity handling
//! - Git URL parsing

pub mod config;
pub mod identity;
pub mod url;

pub use config::*;
pub use identity::*;
pub use url::*;
