//! Background cleanup service implementation

use crate::db::Database;
use std::fs;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::time::interval;

use super::CleanupServiceState;

/// Start the cleanup service that periodically removes old temp projects
pub async fn start_cleanup_service(app_handle: AppHandle) {
    let state = app_handle.state::<CleanupServiceState>();

    // Check if already running
    {
        let mut running = state.running.lock().await;
        if *running {
            return;
        }
        *running = true;
    }

    // Clone for the async task
    let app = app_handle.clone();
    let running = state.running.clone();

    tokio::spawn(async move {
        // Check every hour
        let mut interval = interval(Duration::from_secs(60 * 60));

        loop {
            interval.tick().await;

            // Check if we should stop
            {
                let is_running = running.lock().await;
                if !*is_running {
                    break;
                }
            }

            // Run cleanup
            if let Err(e) = cleanup_temp_projects(&app).await {
                tracing::error!("Error during temp project cleanup: {}", e);
            }
        }
    });
}

/// Clean up temp projects that haven't been accessed in the configured period
async fn cleanup_temp_projects(app: &AppHandle) -> Result<(), String> {
    let db = app.state::<Database>();

    // Get cleanup settings
    let cleanup_days: i64 = db
        .get_setting("temp_project_cleanup_days")
        .map_err(|e| e.to_string())?
        .and_then(|v| v.as_i64())
        .unwrap_or(7);

    // Skip if cleanup is disabled (0 days)
    if cleanup_days <= 0 {
        return Ok(());
    }

    // Get all temp projects
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT p.id, p.path, p.last_opened_at, p.created_at
            FROM projects p
            WHERE p.is_temp = 1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now();
    let cutoff = now - chrono::Duration::days(cleanup_days);
    let cutoff_str = cutoff.format("%Y-%m-%d %H:%M:%S").to_string();

    let projects: Vec<(String, String)> = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let path: String = row.get(1)?;
            let last_opened: Option<String> = row.get(2)?;
            let created_at: String = row.get(3)?;

            // Use last_opened if available, otherwise use created_at
            let check_date = last_opened.unwrap_or(created_at);
            Ok((id, path, check_date))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter(|(_, _, check_date)| check_date < &cutoff_str)
        .map(|(id, path, _)| (id, path))
        .collect();

    drop(stmt);
    drop(conn);

    // Delete each project
    for (id, path) in projects {
        // Delete from filesystem
        if let Err(e) = fs::remove_dir_all(&path) {
            tracing::warn!("Failed to remove temp project directory {}: {}", path, e);
            // Continue anyway to remove from database
        }

        // Delete from database
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        // Delete tags first
        conn.execute("DELETE FROM project_tags WHERE project_id = ?1", [&id])
            .map_err(|e| e.to_string())?;

        // Delete git status cache
        conn.execute("DELETE FROM git_status_cache WHERE project_id = ?1", [&id])
            .map_err(|e| e.to_string())?;

        // Delete the project
        conn.execute("DELETE FROM projects WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;

        tracing::info!("Cleaned up temp project: {}", path);
    }

    Ok(())
}

/// Manually trigger cleanup (exposed as a command)
#[tauri::command]
#[specta::specta]
pub async fn cleanup_temp_projects_now(app_handle: AppHandle) -> Result<u32, String> {
    let db = app_handle.state::<Database>();

    // Get cleanup settings
    let cleanup_days: i64 = db
        .get_setting("temp_project_cleanup_days")
        .map_err(|e| e.to_string())?
        .and_then(|v| v.as_i64())
        .unwrap_or(7);

    // Get all temp projects that are old
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let now = chrono::Utc::now();
    let cutoff = now - chrono::Duration::days(cleanup_days);
    let cutoff_str = cutoff.format("%Y-%m-%d %H:%M:%S").to_string();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT p.id, p.path, COALESCE(p.last_opened_at, p.created_at) as check_date
            FROM projects p
            WHERE p.is_temp = 1
            AND COALESCE(p.last_opened_at, p.created_at) < ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let projects: Vec<(String, String)> = stmt
        .query_map([&cutoff_str], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);
    drop(conn);

    let count = projects.len() as u32;

    // Delete each project
    for (id, path) in projects {
        // Delete from filesystem
        if let Err(e) = fs::remove_dir_all(&path) {
            tracing::warn!("Failed to remove temp project directory {}: {}", path, e);
        }

        // Delete from database
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM project_tags WHERE project_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM git_status_cache WHERE project_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM projects WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

/// Get list of temp projects that would be cleaned up
#[tauri::command]
#[specta::specta]
pub fn get_cleanup_candidates(app_handle: AppHandle) -> Result<Vec<TempProjectInfo>, String> {
    let db = app_handle.state::<Database>();

    let cleanup_days: i64 = db
        .get_setting("temp_project_cleanup_days")
        .map_err(|e| e.to_string())?
        .and_then(|v| v.as_i64())
        .unwrap_or(7);

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let now = chrono::Utc::now();
    let cutoff = now - chrono::Duration::days(cleanup_days);
    let cutoff_str = cutoff.format("%Y-%m-%d %H:%M:%S").to_string();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT p.id, p.name, p.path, COALESCE(p.last_opened_at, p.created_at) as last_activity
            FROM projects p
            WHERE p.is_temp = 1
            AND COALESCE(p.last_opened_at, p.created_at) < ?1
            ORDER BY last_activity ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([&cutoff_str], |row| {
            Ok(TempProjectInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                last_activity: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(projects)
}

#[derive(serde::Serialize, specta::Type)]
pub struct TempProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_activity: String,
}
