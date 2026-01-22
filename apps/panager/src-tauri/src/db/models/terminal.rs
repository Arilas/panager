//! Terminal-related models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

/// A terminal emulator that can be used to open projects
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Terminal {
    pub id: String,
    pub name: String,
    pub command: String,
    pub exec_template: String,
    pub is_auto_detected: bool,
    pub is_available: bool,
    pub created_at: DateTime<Utc>,
}
