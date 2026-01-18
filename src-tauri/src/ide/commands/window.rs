//! Window management commands for IDE

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::{info, warn};

/// Opens an IDE window for a project
///
/// If a window for this project already exists, it will be focused instead of creating a new one.
/// Uses a frameless window with transparent background for native Panager look.
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

    // Create the IDE window matching main window configuration for native Panager look
    // Note: decorations(true) is required for macOS traffic lights to appear
    // titleBarStyle(Overlay) makes traffic lights float over content
    let window = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title(format!("{} - Panager", project_name))
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .decorations(true) // Required for macOS traffic lights
        .transparent(true) // Enable transparent background for glass effects
        .resizable(true)
        .hidden_title(true) // Hide title in macOS traffic light area
        .title_bar_style(tauri::TitleBarStyle::Overlay) // macOS: show traffic lights over content
        .build()
        .map_err(|e| format!("Failed to create IDE window: {}", e))?;

    // Apply vibrancy and liquid glass effects (macOS only)
    // Must run on main thread for vibrancy to work
    #[cfg(target_os = "macos")]
    {
        let window_for_vibrancy = window.clone();
        let window_for_liquid_glass = window.clone();

        // Apply vibrancy on main thread (required by window_vibrancy crate)
        app.run_on_main_thread(move || {
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

            if let Err(e) = apply_vibrancy(&window_for_vibrancy, NSVisualEffectMaterial::Sidebar, None, None) {
                warn!("Failed to apply vibrancy to IDE window: {}", e);
            } else {
                info!("Applied vibrancy to IDE window");
            }
        })
        .map_err(|e| format!("Failed to run on main thread: {}", e))?;

        // Enable Liquid Glass effect after a short delay (WebView needs to be ready)
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Err(e) =
                crate::commands::liquid_glass::enable_liquid_glass_for_window(&window_for_liquid_glass)
            {
                warn!("Failed to enable Liquid Glass for IDE window: {}", e);
            } else {
                info!("Enabled Liquid Glass for IDE window");
                // Emit event to frontend to trigger CSS re-evaluation
                if let Err(e) = window_for_liquid_glass.emit("liquid-glass-ready", ()) {
                    warn!("Failed to emit liquid-glass-ready event: {}", e);
                }
            }
        });
    }

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
