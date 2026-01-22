//! Custom error types for Glide
//!
//! This module provides a unified error type that can be used throughout
//! the application and is compatible with Tauri's command error handling.

use thiserror::Error;

/// Main error type for Glide operations
#[derive(Error, Debug)]
pub enum GlideError {
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

impl GlideError {
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

/// Convert GlideError to String for Tauri command compatibility
impl From<GlideError> for String {
    fn from(err: GlideError) -> Self {
        err.to_string()
    }
}

/// Convert String errors to GlideError
impl From<String> for GlideError {
    fn from(s: String) -> Self {
        Self::General(s)
    }
}

/// Convert &str errors to GlideError
impl From<&str> for GlideError {
    fn from(s: &str) -> Self {
        Self::General(s.to_string())
    }
}

/// Result type alias using GlideError
pub type Result<T> = std::result::Result<T, GlideError>;

/// Serialize GlideError for Tauri
impl serde::Serialize for GlideError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
