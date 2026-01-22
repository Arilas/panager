//! ACP Protocol helpers
//!
//! Most protocol handling is now done by the official agent-client-protocol SDK.
//! This module contains only conversion helpers between our types and SDK types.

/// Convert our AgentMode to SDK SessionModeId string
pub fn to_sdk_mode_id(mode: super::types::AgentMode) -> &'static str {
    match mode {
        super::types::AgentMode::Plan => "plan",
        super::types::AgentMode::Agent => "agent",
        super::types::AgentMode::Ask => "ask",
    }
}

/// Convert SDK SessionModeId to our AgentMode
pub fn from_sdk_mode_id(mode_id: &str) -> super::types::AgentMode {
    match mode_id {
        "plan" => super::types::AgentMode::Plan,
        "agent" => super::types::AgentMode::Agent,
        "ask" => super::types::AgentMode::Ask,
        // Default to Agent mode for unknown modes
        _ => super::types::AgentMode::Agent,
    }
}
