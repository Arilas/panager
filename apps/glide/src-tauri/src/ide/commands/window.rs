//! Window management commands for Glide
//!
//! Handles multi-window support including opening new windows and tracking
//! window close behavior for proper app lifecycle management.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};
use tracing::info;

/// Tracks whether the closing window had a project open.
/// If true, we should spawn a new welcome window after the last window closes.
/// If false (welcome screen was closed), let the app exit.
pub static SHOULD_SPAWN_WELCOME: AtomicBool = AtomicBool::new(false);

/// Opens a new window with the Welcome screen (no project)
#[tauri::command]
#[specta::specta]
pub async fn ide_open_new_window(app: AppHandle) -> Result<(), String> {
    create_window(&app, None).map_err(|e| e.to_string())
}

/// Opens an IDE window for a specific project
#[tauri::command]
#[specta::specta]
pub async fn ide_open_window(
    app: AppHandle,
    project_id: String,
    project_path: String,
    project_name: String,
) -> Result<(), String> {
    create_window(&app, Some((&project_id, &project_path, &project_name)))
        .map_err(|e| e.to_string())
}

/// Closes an IDE window - Not used in Glide (stub for compatibility)
#[tauri::command]
#[specta::specta]
pub async fn ide_close_window(_app: AppHandle, _project_id: String) -> Result<(), String> {
    // Glide manages its own window lifecycle
    Ok(())
}

/// Called by frontend before window closes to indicate whether it had a project open.
/// This determines whether to spawn a new welcome window after close.
#[tauri::command]
#[specta::specta]
pub async fn ide_window_will_close(_app: AppHandle, has_project: bool) -> Result<(), String> {
    info!(
        "Window will close, has_project: {} - will spawn welcome: {}",
        has_project, has_project
    );
    SHOULD_SPAWN_WELCOME.store(has_project, Ordering::SeqCst);
    Ok(())
}

/// Creates a new window with optional project context
pub fn create_window(
    app: &AppHandle,
    project: Option<(&str, &str, &str)>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Generate unique window label
    let label = format!("window-{}", uuid::Uuid::new_v4());

    // Build URL based on whether we have a project
    let (url, window_title) = match project {
        Some((project_id, project_path, project_name)) => {
            info!("Creating window for project: {}", project_name);
            let encoded_path = urlencoding::encode(project_path);
            let encoded_name = urlencoding::encode(project_name);
            let url = format!(
                "index.html?projectId={}&projectPath={}&projectName={}",
                project_id, encoded_path, encoded_name
            );
            (url, project_name.to_string())
        }
        None => {
            info!("Creating welcome window");
            ("index.html".to_string(), "Glide".to_string())
        }
    };

    let webview_url = WebviewUrl::App(url.into());
    let window = WebviewWindowBuilder::new(app, &label, webview_url)
        .title(&window_title)
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 600.0)
        .transparent(true)
        .decorations(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .build()?;

    // Apply platform-specific setup (vibrancy and liquid glass on macOS)
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

        if let Err(e) = apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None) {
            tracing::warn!("Failed to apply vibrancy: {}", e);
        }

        // Defer Liquid Glass initialization until WebView is ready
        let window_clone = window.clone();
        std::thread::spawn(move || {
            // Wait for WebView to be fully initialized
            std::thread::sleep(std::time::Duration::from_millis(200));
            if let Err(e) =
                crate::platform::macos::liquid_glass::enable_liquid_glass_for_window(&window_clone)
            {
                tracing::warn!("Failed to enable Liquid Glass: {}", e);
            } else {
                // Emit event to frontend to trigger CSS re-evaluation
                if let Err(e) = window_clone.emit("liquid-glass-ready", ()) {
                    tracing::warn!("Failed to emit liquid-glass-ready event: {}", e);
                }
            }
        });
    }

    Ok(())
}
