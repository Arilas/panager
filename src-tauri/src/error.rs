//! Custom error types for Panager
//!
//! This module provides a unified error type that can be used throughout
//! the application and is compatible with Tauri's command error handling.

use thiserror::Error;

/// Main error type for Panager operations
#[derive(Error, Debug)]
pub enum PanagerError {
    /// Database-related errors
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    /// Git-related errors
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    /// IO-related errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization/deserialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// Entity not found errors
    #[error("{entity} not found: {id}")]
    NotFound {
        entity: &'static str,
        id: String,
    },

    /// Validation errors
    #[error("Validation error: {0}")]
    Validation(String),

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Platform-specific errors
    #[error("Platform error: {0}")]
    Platform(String),

    /// Mutex lock errors
    #[error("Lock error: {0}")]
    Lock(String),

    /// General errors with a message
    #[error("{0}")]
    General(String),
}

impl PanagerError {
    /// Create a not found error
    pub fn not_found(entity: &'static str, id: impl Into<String>) -> Self {
        Self::NotFound {
            entity,
            id: id.into(),
        }
    }

    /// Create a validation error
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    /// Create a configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create a platform error
    pub fn platform(msg: impl Into<String>) -> Self {
        Self::Platform(msg.into())
    }

    /// Create a lock error
    pub fn lock(msg: impl Into<String>) -> Self {
        Self::Lock(msg.into())
    }
}

/// Convert PanagerError to String for Tauri command compatibility
impl From<PanagerError> for String {
    fn from(err: PanagerError) -> Self {
        err.to_string()
    }
}

/// Convert String errors to PanagerError
impl From<String> for PanagerError {
    fn from(s: String) -> Self {
        Self::General(s)
    }
}

/// Convert &str errors to PanagerError
impl From<&str> for PanagerError {
    fn from(s: &str) -> Self {
        Self::General(s.to_string())
    }
}

/// Result type alias using PanagerError
pub type Result<T> = std::result::Result<T, PanagerError>;

/// Serialize PanagerError for Tauri
impl serde::Serialize for PanagerError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_error() {
        let err = PanagerError::not_found("Project", "abc123");
        assert_eq!(err.to_string(), "Project not found: abc123");
    }

    #[test]
    fn test_validation_error() {
        let err = PanagerError::validation("Name cannot be empty");
        assert_eq!(err.to_string(), "Validation error: Name cannot be empty");
    }

    #[test]
    fn test_error_to_string_conversion() {
        let err = PanagerError::config("Invalid config");
        let s: String = err.into();
        assert_eq!(s, "Configuration error: Invalid config");
    }

    #[test]
    fn test_string_to_error_conversion() {
        let err: PanagerError = "Something went wrong".into();
        assert_eq!(err.to_string(), "Something went wrong");
    }
}
