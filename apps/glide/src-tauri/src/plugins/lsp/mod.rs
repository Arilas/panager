//! Generic LSP Client Module
//!
//! This module provides a reusable LSP client infrastructure that can be
//! configured for different language servers via the LspConfig trait.

mod client;
mod config;

pub use client::LspClient;
pub use config::LspConfig;
