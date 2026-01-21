//! Application setup and lifecycle management
//!
//! This module contains all the application initialization and lifecycle code,
//! extracted from lib.rs to keep it slim and focused.

pub mod lifecycle;
pub mod plugins;
pub mod state;

pub use lifecycle::*;
pub use plugins::*;
pub use state::*;
