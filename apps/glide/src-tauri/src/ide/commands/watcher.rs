//! File system watcher commands for IDE

use tauri::AppHandle;
use tracing::info;

/// Starts watching a directory for changes
///
/// Events are emitted to the specified window label.
#[tauri::command]
#[specta::specta]
pub async fn ide_start_watcher(
    app: AppHandle,
    window_label: String,
    project_path: String,
) -> Result<(), String> {
    info!(
        "Starting file watcher for {} (window: {})",
        project_path, window_label
    );

    crate::ide::watcher::start_watcher(app, window_label, project_path).await
}

/// Stops watching a directory
#[tauri::command]
#[specta::specta]
pub async fn ide_stop_watcher(
    app: AppHandle,
    window_label: String,
) -> Result<(), String> {
    info!("Stopping file watcher for window: {}", window_label);

    crate::ide::watcher::stop_watcher(app, window_label).await
}
