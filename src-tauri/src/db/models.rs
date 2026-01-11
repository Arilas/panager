use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectSettings {
    pub cleanup_days: i32,
    pub setup_git_identity: bool,
    pub preferred_package_manager: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scope {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub default_editor_id: Option<String>,
    pub settings: Option<serde_json::Value>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // New fields for Max features
    pub default_folder: Option<String>,
    pub folder_scan_interval: Option<i64>,
    pub ssh_alias: Option<String>,
    // Temp project settings
    pub temp_project_settings: Option<TempProjectSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeLink {
    pub id: String,
    pub scope_id: String,
    pub link_type: String,
    pub label: String,
    pub url: String,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub scope_id: String,
    pub name: String,
    pub path: String,
    pub preferred_editor_id: Option<String>,
    pub is_temp: bool,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTag {
    pub id: String,
    pub project_id: String,
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

// Request/Response DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScopeRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub default_folder: Option<String>,
    pub ssh_alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScopeRequest {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub default_editor_id: Option<String>,
    pub settings: Option<serde_json::Value>,
    pub default_folder: Option<String>,
    pub folder_scan_interval: Option<i64>,
    pub ssh_alias: Option<String>,
    pub temp_project_settings: Option<TempProjectSettings>,
}

// Request DTOs for new features
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSshAliasRequest {
    pub host: String,
    pub host_name: String,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub public_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGitConfigRequest {
    pub scope_id: String,
    pub user_name: String,
    pub user_email: String,
    pub gpg_signing_method: String,  // "none", "manual", "password_manager"
    pub signing_key: Option<String>,
    pub raw_gpg_config: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub scope_id: String,
    pub name: String,
    pub path: String,
    pub is_temp: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScopeLinkRequest {
    pub scope_id: String,
    pub link_type: String,
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWithStatus {
    pub project: Project,
    pub tags: Vec<String>,
    pub git_status: Option<GitStatusCache>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeWithLinks {
    pub scope: Scope,
    pub links: Vec<ScopeLink>,
}

// New models for Max features

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredFolderWarning {
    pub id: String,
    pub scope_id: String,
    pub project_path: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeGitConfig {
    pub scope_id: String,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub gpg_sign: bool,
    pub gpg_signing_method: Option<String>,  // "none", "manual", "password_manager"
    pub signing_key: Option<String>,
    pub raw_gpg_config: Option<String>,
    pub config_file_path: Option<String>,
    pub last_checked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfigIssue {
    pub id: String,
    pub project_id: String,
    pub issue_type: String,
    pub expected_value: Option<String>,
    pub actual_value: Option<String>,
    pub dismissed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshAlias {
    pub host: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub identity_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitIncludeIf {
    pub condition: String,
    pub path: String,
}
