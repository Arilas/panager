//! Platform abstraction types
//!
//! Shared types used across platform-specific modules.
//! Platform-specific behavior is implemented directly in each platform module
//! using `cfg` attributes, which is simpler than trait-based abstraction
//! for our use case.

/// Editor information returned by detection
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EditorInfo {
    pub name: String,
    pub command: String,
    pub icon: Option<String>,
}

/// Terminal information returned by detection
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TerminalInfo {
    pub name: String,
    pub command: String,
    pub exec_template: String,
}
