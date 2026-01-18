//! Window management commands for IDE

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::{info, warn};

/// Opens an IDE window for a project
///
/// If a window for this project already exists, it will be focused instead of creating a new one.
#[tauri::command]
#[specta::specta]
pub async fn ide_open_window(
    app: AppHandle,
    project_id: String,
    project_path: String,
    project_name: String,
) -> Result<(), String> {
    let window_label = format!("ide-{}", project_id);

    // Check if window already exists
    if let Some(window) = app.get_webview_window(&window_label) {
        // Try to focus the existing window
        // If this fails, the window handle is stale (window was closed)
        match window.set_focus() {
            Ok(_) => {
                info!("IDE window already exists for project {}, focused", project_id);
                return Ok(());
            }
            Err(e) => {
                // Window handle is stale - this happens when window was closed
                // We need to try to close/destroy it first before creating a new one
                warn!("IDE window handle stale for project {}: {}", project_id, e);
                // Try to close it to clean up
                let _ = window.close();
            }
        }
    }

    info!("Creating new IDE window for project: {}", project_name);

    // Build the URL with query parameters
    let url = format!(
        "/ide.html?projectId={}&projectPath={}&projectName={}",
        urlencoding::encode(&project_id),
        urlencoding::encode(&project_path),
        urlencoding::encode(&project_name)
    );

    // Create the IDE window
    WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title(format!("{} - Panager", project_name))
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to create IDE window: {}", e))?;

    Ok(())
}

/// Closes an IDE window for a project
#[tauri::command]
#[specta::specta]
pub async fn ide_close_window(app: AppHandle, project_id: String) -> Result<(), String> {
    let window_label = format!("ide-{}", project_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
