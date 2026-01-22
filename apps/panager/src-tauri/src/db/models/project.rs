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
    pub is_pinned: bool,
    pub group_id: Option<String>,
    pub notes: Option<String>,
    pub description: Option<String>,
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

/// A link associated with a project (e.g., documentation, CI/CD)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectLink {
    pub id: String,
    pub project_id: String,
    pub link_type: String,
    pub label: String,
    pub url: String,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// A group for organizing projects within a scope
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub id: String,
    pub scope_id: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// A custom command/script for a project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCommand {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub command: String,
    pub description: Option<String>,
    pub working_directory: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Statistics about a project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStatistics {
    pub file_count: Option<u64>,
    pub repo_size_bytes: Option<u64>,
    pub commit_count: Option<u64>,
    pub last_commit: Option<LastCommitInfo>,
    pub languages: Vec<LanguageInfo>,
    pub contributors: Vec<ContributorInfo>,
}

/// Information about the last commit
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LastCommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: DateTime<Utc>,
}

/// Language information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LanguageInfo {
    pub name: String,
    pub bytes: u64,
    pub percentage: f64,
}

/// Contributor information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContributorInfo {
    pub name: String,
    pub email: String,
    pub commit_count: u64,
}

/// A project with its tags and cached git status
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWithStatus {
    pub project: Project,
    pub tags: Vec<String>,
    pub git_status: Option<GitStatusCache>,
    pub links: Vec<ProjectLink>,
    pub group: Option<ProjectGroup>,
    pub statistics: Option<ProjectStatistics>,
}
