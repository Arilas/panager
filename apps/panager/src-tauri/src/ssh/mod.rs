//! SSH functionality for Panager
//!
//! This module handles SSH configuration management including
//! reading and writing SSH aliases in ~/.ssh/config.

pub mod config;

pub use config::*;
