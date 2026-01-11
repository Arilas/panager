//! Scope-related models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Settings for temporary project management within a scope
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectSettings {
    pub cleanup_days: i32,
    pub setup_git_identity: bool,
    pub preferred_package_manager: String,
}

/// A scope represents a logical grouping of projects (e.g., "Work", "Personal")
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    pub default_folder: Option<String>,
    pub folder_scan_interval: Option<i64>,
    pub ssh_alias: Option<String>,
    pub temp_project_settings: Option<TempProjectSettings>,
}

/// A link associated with a scope (e.g., documentation, CI/CD)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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

/// A scope with its associated links
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScopeWithLinks {
    pub scope: Scope,
    pub links: Vec<ScopeLink>,
}

/// Git configuration for a scope (identity, signing settings)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScopeGitConfig {
    pub scope_id: String,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub gpg_sign: bool,
    pub gpg_signing_method: Option<String>,
    pub signing_key: Option<String>,
    pub raw_gpg_config: Option<String>,
    pub config_file_path: Option<String>,
    pub last_checked_at: Option<DateTime<Utc>>,
}

/// Record of folder warnings that the user has dismissed
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredFolderWarning {
    pub id: String,
    pub scope_id: String,
    pub project_path: String,
    pub created_at: DateTime<Utc>,
}

/// Git includeIf directive information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitIncludeIf {
    pub condition: String,
    pub path: String,
}
