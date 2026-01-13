//! Project-related models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

/// A project represents a code repository or folder
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub scope_id: String,
    pub name: String,
    pub path: String,
    pub preferred_editor_id: Option<String>,
    pub default_branch: Option<String>,
    pub workspace_file: Option<String>,
    pub is_temp: bool,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Cached git status information for a project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusCache {
    pub project_id: String,
    pub branch: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub has_uncommitted: bool,
    pub has_untracked: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub remote_url: Option<String>,
}

/// A project with its tags and cached git status
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWithStatus {
    pub project: Project,
    pub tags: Vec<String>,
    pub git_status: Option<GitStatusCache>,
}
