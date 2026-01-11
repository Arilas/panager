//! Editor-related models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

/// An editor that can be used to open projects
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Editor {
    pub id: String,
    pub name: String,
    pub command: String,
    pub icon: Option<String>,
    pub is_auto_detected: bool,
    pub is_available: bool,
    pub created_at: DateTime<Utc>,
}

/// SSH alias configuration
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SshAlias {
    pub host: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub identity_file: Option<String>,
}
