//! Recent Projects Management
//!
//! Tracks recently opened projects for quick access from the welcome screen.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use tracing::info;

const MAX_RECENT_PROJECTS: usize = 10;
const RECENT_PROJECTS_FILE: &str = "recent-projects.json";

/// A recently opened project
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    /// Unique project ID (MD5 hash of path)
    pub id: String,
    /// Project name (folder name)
    pub name: String,
    /// Full path to the project
    pub path: String,
    /// Last opened timestamp
    pub last_opened: DateTime<Utc>,
}

/// Get the path to the recent projects file
fn get_recent_projects_path() -> Result<PathBuf, String> {
    let config_dir = directories::ProjectDirs::from("com", "krona", "glide")
        .ok_or("Failed to get config directory")?
        .config_dir()
        .to_path_buf();

    // Ensure directory exists
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    Ok(config_dir.join(RECENT_PROJECTS_FILE))
}

/// Load recent projects from disk
fn load_recent_projects() -> Result<Vec<RecentProject>, String> {
    let path = get_recent_projects_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent projects: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recent projects: {}", e))
}

/// Save recent projects to disk
fn save_recent_projects(projects: &[RecentProject]) -> Result<(), String> {
    let path = get_recent_projects_path()?;

    let content = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write recent projects: {}", e))
}

/// Get list of recent projects
#[tauri::command]
#[specta::specta]
pub fn ide_get_recent_projects() -> Result<Vec<RecentProject>, String> {
    let mut projects = load_recent_projects()?;

    // Filter out projects that no longer exist
    projects.retain(|p| std::path::Path::new(&p.path).exists());

    // Sort by last opened (most recent first)
    projects.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));

    Ok(projects)
}

/// Add or update a project in the recent list
#[tauri::command]
#[specta::specta]
pub fn ide_add_recent_project(id: String, name: String, path: String) -> Result<(), String> {
    info!("Adding recent project: {} ({})", name, path);

    let mut projects = load_recent_projects().unwrap_or_default();

    // Remove existing entry with same path (if any)
    projects.retain(|p| p.path != path);

    // Add new entry at the beginning
    projects.insert(
        0,
        RecentProject {
            id,
            name,
            path,
            last_opened: Utc::now(),
        },
    );

    // Keep only the most recent projects
    projects.truncate(MAX_RECENT_PROJECTS);

    save_recent_projects(&projects)
}

/// Remove a project from the recent list
#[tauri::command]
#[specta::specta]
pub fn ide_remove_recent_project(path: String) -> Result<(), String> {
    info!("Removing recent project: {}", path);

    let mut projects = load_recent_projects()?;
    projects.retain(|p| p.path != path);
    save_recent_projects(&projects)
}

/// Clear all recent projects
#[tauri::command]
#[specta::specta]
pub fn ide_clear_recent_projects() -> Result<(), String> {
    info!("Clearing all recent projects");
    save_recent_projects(&[])
}
