//! Background folder scanner service implementation

use crate::db::Database;
use chrono::Utc;
use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use walkdir::WalkDir;

use super::FolderScanServiceState;

/// Start the folder scan service that periodically scans scope folders
pub async fn start_folder_scan_service(app_handle: AppHandle) {
    let state = match app_handle.try_state::<FolderScanServiceState>() {
        Some(s) => s,
        None => return,
    };

    // Check if already running
    {
        let mut running = state.running.lock().await;
        if *running {
            return;
        }
        *running = true;
    }

    let app = app_handle.clone();
    let running = state.running.clone();

    // Run initial scan on startup
    if let Err(e) = scan_all_scope_folders(&app) {
        tracing::error!("Error during initial folder scan: {}", e);
    }

    // Check every 5 minutes by default
    loop {
        tokio::time::sleep(Duration::from_secs(60 * 5)).await;

        {
            let is_running = running.lock().await;
            if !*is_running {
                break;
            }
        }

        if let Err(e) = scan_all_scope_folders(&app) {
            tracing::error!("Error during folder scan: {}", e);
        }
    }
}

/// Scan all scope folders that have a default_folder set
fn scan_all_scope_folders(app: &AppHandle) -> Result<(), String> {
    let db = app.state::<Database>();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get all scopes with a default_folder
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, default_folder
            FROM scopes
            WHERE default_folder IS NOT NULL AND default_folder != ''
            "#,
        )
        .map_err(|e| e.to_string())?;

    let scopes: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);
    drop(conn);

    for (scope_id, folder) in scopes {
        if let Err(e) = scan_and_add_repos(app, &scope_id, &folder) {
            tracing::warn!("Error scanning folder {}: {}", folder, e);
        }
    }

    Ok(())
}

/// Scan a folder for git repos and auto-add them to the scope
fn scan_and_add_repos(app: &AppHandle, scope_id: &str, folder: &str) -> Result<Vec<String>, String> {
    let db = app.state::<Database>();

    // Get existing project paths in this scope
    let existing_paths: HashSet<String> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT path FROM projects WHERE scope_id = ?1")
            .map_err(|e| e.to_string())?;

        let paths: Vec<String> = stmt
            .query_map([scope_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        paths.into_iter().collect()
    };

    // Scan for git repos
    let discovered = scan_folder_for_git_repos(folder)?;

    // Find new repos (not already in scope)
    let mut added = Vec::new();
    for path in discovered {
        if !existing_paths.contains(&path) {
            // Add the project
            let name = Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();

            let id = Uuid::new_v4().to_string();
            let now = Utc::now();

            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            conn.execute(
                r#"
                INSERT OR IGNORE INTO projects (id, scope_id, name, path, is_temp, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
                "#,
                (&id, scope_id, &name, &path, now.to_rfc3339(), now.to_rfc3339()),
            )
            .map_err(|e| e.to_string())?;

            added.push(path);
        }
    }

    Ok(added)
}

/// Scan a folder for git repositories (paths containing .git)
fn scan_folder_for_git_repos(folder: &str) -> Result<Vec<String>, String> {
    let mut repos = Vec::new();
    let folder_path = Path::new(folder);

    if !folder_path.exists() {
        return Ok(repos);
    }

    // Walk directory up to 4 levels deep
    for entry in WalkDir::new(folder_path)
        .max_depth(4)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.file_name() == Some(std::ffi::OsStr::new(".git")) && path.is_dir() {
            if let Some(parent) = path.parent() {
                if let Some(path_str) = parent.to_str() {
                    repos.push(path_str.to_string());
                }
            }
        }
    }

    Ok(repos)
}

/// Manually trigger a folder scan for a scope
#[tauri::command]
#[specta::specta]
pub fn scan_scope_folder(app_handle: AppHandle, scope_id: String) -> Result<Vec<String>, String> {
    let db = app_handle.state::<Database>();

    // Get the scope's default folder
    let folder: String = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT default_folder FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };

    if folder.is_empty() {
        return Err("Scope has no default folder set".to_string());
    }

    scan_and_add_repos(&app_handle, &scope_id, &folder)
}

/// Move a project folder to the scope's default folder
#[tauri::command]
#[specta::specta]
pub fn move_project_to_scope_folder(db: State<Database>, project_id: String) -> Result<String, String> {
    move_project_to_scope_folder_internal(&db, &project_id)
}

/// Internal version of move_project_to_scope_folder for use without State wrapper
pub fn move_project_to_scope_folder_internal(db: &Database, project_id: &str) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get project and scope info
    let (project_path, scope_id): (String, String) = conn
        .query_row(
            "SELECT path, scope_id FROM projects WHERE id = ?1",
            [project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let default_folder: String = conn
        .query_row(
            "SELECT default_folder FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Scope has no default folder: {}", e))?;

    if default_folder.is_empty() {
        return Err("Scope has no default folder set".to_string());
    }

    // Get project folder name
    let folder_name = Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid project path")?;

    // New path
    let new_path = Path::new(&default_folder).join(folder_name);
    let new_path_str = new_path.to_str().ok_or("Invalid new path")?;

    // Check if destination exists
    if new_path.exists() {
        return Err(format!("Destination already exists: {}", new_path_str));
    }

    // Move the folder
    std::fs::rename(&project_path, &new_path).map_err(|e| format!("Failed to move folder: {}", e))?;

    // Update database
    let now = Utc::now();
    conn.execute(
        "UPDATE projects SET path = ?1, updated_at = ?2 WHERE id = ?3",
        (new_path_str, now.to_rfc3339(), project_id),
    )
    .map_err(|e| e.to_string())?;

    Ok(new_path_str.to_string())
}
