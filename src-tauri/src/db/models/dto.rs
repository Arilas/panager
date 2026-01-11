//! Data Transfer Objects (DTOs) for request/response handling
//!
//! These structs are used for API communication and don't map directly to database tables.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::TempProjectSettings;

/// Request to create a new scope
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateScopeRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub default_folder: Option<String>,
    pub ssh_alias: Option<String>,
}

/// Request to create a new SSH alias
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateSshAliasRequest {
    pub host: String,
    pub host_name: String,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub public_key: Option<String>,
}

/// Request to create a new project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub scope_id: String,
    pub name: String,
    pub path: String,
    pub is_temp: Option<bool>,
}

/// Request to create a new scope link
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateScopeLinkRequest {
    pub scope_id: String,
    pub link_type: String,
    pub label: String,
    pub url: String,
}

/// Request for creating a temporary project
///
/// Matches the request format used by the create_temp_project command
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectRequest {
    pub scope_id: String,
    pub name: String,
    pub package_manager: String,
    pub template: String,
    pub options: Option<serde_json::Value>,
}

/// Result of creating a temporary project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectResult {
    pub success: bool,
    pub project_id: Option<String>,
    pub project_path: Option<String>,
    pub error: Option<String>,
}

/// Progress event for temporary project creation
///
/// Emitted during project creation via temp-project-progress event
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectProgress {
    pub line: String,
    pub is_error: bool,
    pub status: Option<String>,
}

/// Options for cloning a repository
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloneOptions {
    pub shallow: bool,
    pub branch: Option<String>,
    pub use_ssh_alias: Option<String>,
}

/// Result of cloning a repository
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    pub success: bool,
    pub project_id: Option<String>,
    pub project_path: Option<String>,
    pub error: Option<String>,
}

/// Progress event for clone operation
///
/// Emitted during clone via clone-progress event
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloneProgress {
    pub line: String,
    pub is_error: bool,
    pub status: Option<String>,
}

/// Updates to apply to a scope (all fields optional)
#[derive(Debug, Clone, Default)]
pub struct ScopeUpdates {
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub default_editor_id: Option<String>,
    pub default_folder: Option<String>,
    pub folder_scan_interval: Option<i64>,
    pub ssh_alias: Option<String>,
    pub temp_project_settings: Option<TempProjectSettings>,
}

/// Updates to apply to a project (all fields optional)
#[derive(Debug, Clone, Default)]
pub struct ProjectUpdates {
    pub name: Option<String>,
    pub preferred_editor_id: Option<String>,
    pub scope_id: Option<String>,
}
