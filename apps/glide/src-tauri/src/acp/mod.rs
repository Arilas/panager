//! ACP (Agent Client Protocol) Module
//!
//! This module implements the ACP client for communication with Claude Code
//! using the official agent-client-protocol SDK.
//!
//! Reference: https://agentclientprotocol.com

pub mod commands;
pub mod process;
pub mod protocol;
pub mod types;

pub use commands::*;
pub use process::{AcpProcess, AcpState};
pub use types::*;
