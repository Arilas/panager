//! Tab Management Commands
//!
//! Tauri commands for managing tabs and tab groups.
//! All commands are prefixed with `ide_` to avoid conflicts.

use crate::ide::db::tabs::{DbTab, DbTabGroup, DbTabSession, TabsDb};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;
use tracing::info;

/// Cache of TabsDb instances per project path
static TABS_DB_CACHE: Lazy<RwLock<HashMap<PathBuf, TabsDb>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Get or create a TabsDb for a project
fn get_tabs_db(project_path: &str) -> Result<(), String> {
    let path = PathBuf::from(project_path);
    let cache = TABS_DB_CACHE.read().unwrap();

    if cache.contains_key(&path) {
        return Ok(());
    }
    drop(cache);

    // Create new connection
    let db = TabsDb::open(&path).map_err(|e| format!("Failed to open tabs database: {}", e))?;

    let mut cache = TABS_DB_CACHE.write().unwrap();
    cache.insert(path, db);
    Ok(())
}

/// Execute a database operation with the cached connection
fn with_tabs_db<T, F>(project_path: &str, f: F) -> Result<T, String>
where
    F: FnOnce(&TabsDb) -> Result<T, rusqlite::Error>,
{
    get_tabs_db(project_path)?;

    let path = PathBuf::from(project_path);
    let cache = TABS_DB_CACHE.read().unwrap();
    let db = cache
        .get(&path)
        .ok_or_else(|| "Database not found in cache".to_string())?;

    f(db).map_err(|e| format!("Database error: {}", e))
}

// ============================================================
// Tab Group Commands
// ============================================================

/// Get all tab groups for a project
#[tauri::command]
#[specta::specta]
pub fn ide_get_tab_groups(project_path: String) -> Result<Vec<DbTabGroup>, String> {
    info!("Getting tab groups for: {}", project_path);
    with_tabs_db(&project_path, |db| db.get_groups())
}

/// Create a new tab group
#[tauri::command]
#[specta::specta]
pub fn ide_create_tab_group(project_path: String, group_id: String) -> Result<DbTabGroup, String> {
    info!("Creating tab group: {} in {}", group_id, project_path);
    with_tabs_db(&project_path, |db| db.create_group(&group_id))
}

/// Delete a tab group
#[tauri::command]
#[specta::specta]
pub fn ide_delete_tab_group(project_path: String, group_id: String) -> Result<(), String> {
    info!("Deleting tab group: {} in {}", group_id, project_path);
    with_tabs_db(&project_path, |db| db.delete_group(&group_id))
}

/// Set the active tab group
#[tauri::command]
#[specta::specta]
pub fn ide_set_active_group(project_path: String, group_id: String) -> Result<(), String> {
    info!("Setting active group: {} in {}", group_id, project_path);
    with_tabs_db(&project_path, |db| db.set_active_group(&group_id))
}

/// Reorder tab groups
#[tauri::command]
#[specta::specta]
pub fn ide_reorder_groups(project_path: String, group_ids: Vec<String>) -> Result<(), String> {
    info!("Reordering groups in {}: {:?}", project_path, group_ids);
    with_tabs_db(&project_path, |db| db.reorder_groups(&group_ids))
}

// ============================================================
// Tab Commands
// ============================================================

/// Get all tabs for a specific group
#[tauri::command]
#[specta::specta]
pub fn ide_get_tabs(project_path: String, group_id: String) -> Result<Vec<DbTab>, String> {
    info!("Getting tabs for group: {} in {}", group_id, project_path);
    with_tabs_db(&project_path, |db| db.get_tabs(&group_id))
}

/// Get all tabs across all groups
#[tauri::command]
#[specta::specta]
pub fn ide_get_all_tabs(project_path: String) -> Result<Vec<DbTab>, String> {
    info!("Getting all tabs for: {}", project_path);
    with_tabs_db(&project_path, |db| db.get_all_tabs())
}

/// Save a tab (insert or update)
#[tauri::command]
#[specta::specta]
pub fn ide_save_tab(project_path: String, tab: DbTab) -> Result<i64, String> {
    info!("Saving tab: {} in group {} ({})", tab.url, tab.group_id, project_path);
    with_tabs_db(&project_path, |db| db.save_tab(&tab))
}

/// Update a tab's URL (e.g., chat://new -> chat://session-id)
#[tauri::command]
#[specta::specta]
pub fn ide_update_tab_url(
    project_path: String,
    group_id: String,
    old_url: String,
    new_url: String,
) -> Result<(), String> {
    info!(
        "Updating tab URL in group {}: {} -> {} ({})",
        group_id, old_url, new_url, project_path
    );
    with_tabs_db(&project_path, |db| {
        db.update_tab_url(&group_id, &old_url, &new_url)
    })
}

/// Delete a tab
#[tauri::command]
#[specta::specta]
pub fn ide_delete_tab(project_path: String, group_id: String, url: String) -> Result<(), String> {
    info!("Deleting tab: {} from group {} ({})", url, group_id, project_path);
    with_tabs_db(&project_path, |db| db.delete_tab(&group_id, &url))
}

/// Set the active tab within a group
#[tauri::command]
#[specta::specta]
pub fn ide_set_active_tab(
    project_path: String,
    group_id: String,
    url: String,
) -> Result<(), String> {
    info!(
        "Setting active tab: {} in group {} ({})",
        url, group_id, project_path
    );
    with_tabs_db(&project_path, |db| db.set_active_tab(&group_id, &url))
}

/// Reorder tabs within a group
#[tauri::command]
#[specta::specta]
pub fn ide_reorder_tabs(
    project_path: String,
    group_id: String,
    urls: Vec<String>,
) -> Result<(), String> {
    info!(
        "Reordering tabs in group {}: {:?} ({})",
        group_id, urls, project_path
    );
    with_tabs_db(&project_path, |db| db.reorder_tabs(&group_id, &urls))
}

/// Move a tab to a different group
#[tauri::command]
#[specta::specta]
pub fn ide_move_tab_to_group(
    project_path: String,
    url: String,
    from_group: String,
    to_group: String,
) -> Result<(), String> {
    info!(
        "Moving tab {} from {} to {} ({})",
        url, from_group, to_group, project_path
    );
    with_tabs_db(&project_path, |db| {
        db.move_tab_to_group(&url, &from_group, &to_group)
    })
}

/// Update tab session data (cursor, scroll, etc.)
#[tauri::command]
#[specta::specta]
pub fn ide_update_tab_session(
    project_path: String,
    group_id: String,
    url: String,
    session: DbTabSession,
) -> Result<(), String> {
    // Don't log every cursor update - too noisy
    with_tabs_db(&project_path, |db| {
        db.update_tab_session(&group_id, &url, &session)
    })
}

/// Pin or unpin a tab
#[tauri::command]
#[specta::specta]
pub fn ide_set_tab_pinned(
    project_path: String,
    group_id: String,
    url: String,
    pinned: bool,
) -> Result<(), String> {
    info!(
        "Setting tab pinned: {} = {} in group {} ({})",
        url, pinned, group_id, project_path
    );
    with_tabs_db(&project_path, |db| {
        db.set_tab_pinned(&group_id, &url, pinned)
    })
}

/// Convert a preview tab to a permanent tab
#[tauri::command]
#[specta::specta]
pub fn ide_convert_preview_to_permanent(
    project_path: String,
    group_id: String,
    url: String,
) -> Result<(), String> {
    info!(
        "Converting preview to permanent: {} in group {} ({})",
        url, group_id, project_path
    );
    with_tabs_db(&project_path, |db| {
        db.convert_preview_to_permanent(&group_id, &url)
    })
}

/// Delete all preview tabs in a group
#[tauri::command]
#[specta::specta]
pub fn ide_delete_preview_tabs(project_path: String, group_id: String) -> Result<(), String> {
    info!(
        "Deleting preview tabs in group {} ({})",
        group_id, project_path
    );
    with_tabs_db(&project_path, |db| db.delete_preview_tabs(&group_id))
}

/// Clear all tabs and groups (for testing or reset)
#[tauri::command]
#[specta::specta]
pub fn ide_clear_all_tabs(project_path: String) -> Result<(), String> {
    info!("Clearing all tabs for: {}", project_path);
    with_tabs_db(&project_path, |db| db.clear_all())
}
