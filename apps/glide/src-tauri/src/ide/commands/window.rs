//! Window management commands for Glide
//!
//! Note: Glide doesn't need ide_open_window/ide_close_window
//! as it IS the window. These are placeholder exports for compatibility.

use tauri::AppHandle;

/// Opens an IDE window - Not used in Glide (stub for compatibility)
#[tauri::command]
#[specta::specta]
pub async fn ide_open_window(
    _app: AppHandle,
    _project_id: String,
    _project_path: String,
    _project_name: String,
) -> Result<(), String> {
    // Glide is already the window, no-op
    Ok(())
}

/// Closes an IDE window - Not used in Glide (stub for compatibility)
#[tauri::command]
#[specta::specta]
pub async fn ide_close_window(_app: AppHandle, _project_id: String) -> Result<(), String> {
    // Glide manages its own window lifecycle
    Ok(())
}
