//! Window management commands for Glide
//!
//! Handles multi-window support including opening new windows and tracking
//! window close behavior for proper app lifecycle management.

use super::session::WindowGeometry;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};
use tracing::info;

/// CSP policy that allows Monaco Editor workers and Tauri IPC to function properly.
/// Permits blob: URLs for workers, unsafe-eval for Monaco's syntax highlighting,
/// data: URLs for various editor features, and ipc:/tauri: for Tauri commands.
pub const PERMISSIVE_CSP: &str = "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: tauri: ipc:; \
    connect-src 'self' blob: data: tauri: ipc: ipc://localhost; \
    worker-src 'self' blob:; \
    script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: tauri:; \
    style-src 'self' 'unsafe-inline';";

/// Tracks whether the closing window had a project open.
/// If true, we should spawn a new welcome window after the last window closes.
/// If false (welcome screen was closed), let the app exit.
pub static SHOULD_SPAWN_WELCOME: AtomicBool = AtomicBool::new(false);

/// In-memory registry of open windows and their associated projects
/// Key: window label, Value: project path (None for welcome windows)
static OPEN_WINDOWS: Lazy<RwLock<HashMap<String, Option<String>>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Register a window in the registry
pub fn register_window(label: &str, project_path: Option<&str>) {
    if let Ok(mut windows) = OPEN_WINDOWS.write() {
        windows.insert(label.to_string(), project_path.map(|s| s.to_string()));
        info!(
            "Registered window: {} (project: {:?})",
            label,
            project_path
        );
    }
}

/// Unregister a window from the registry
pub fn unregister_window(label: &str) {
    if let Ok(mut windows) = OPEN_WINDOWS.write() {
        windows.remove(label);
        info!("Unregistered window: {}", label);
    }
}

/// Find a window that has the given project open
/// Returns the window label if found
pub fn find_window_by_project(project_path: &str) -> Option<String> {
    if let Ok(windows) = OPEN_WINDOWS.read() {
        for (label, path) in windows.iter() {
            if let Some(p) = path {
                if p == project_path {
                    return Some(label.clone());
                }
            }
        }
    }
    None
}

/// Opens a new window with the Welcome screen (no project)
#[tauri::command]
#[specta::specta]
pub async fn ide_open_new_window(app: AppHandle) -> Result<(), String> {
    create_window(&app, None, None)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Opens an IDE window for a specific project
/// If the project is already open in another window, focuses that window instead
/// Returns true if a new window was created, false if an existing window was focused
#[tauri::command]
#[specta::specta]
pub async fn ide_open_window(
    app: AppHandle,
    project_id: String,
    project_path: String,
    project_name: String,
) -> Result<bool, String> {
    // Check if project is already open in another window
    if let Some(existing_label) = find_window_by_project(&project_path) {
        info!(
            "Project {} already open in window {}, focusing",
            project_name, existing_label
        );
        // Focus the existing window
        if let Some(window) = app.get_webview_window(&existing_label) {
            window.set_focus().map_err(|e| e.to_string())?;
            return Ok(false); // Existing window was focused
        }
    }

    // Create new window for the project
    create_window(&app, Some((&project_id, &project_path, &project_name)), None)
        .map(|_| true) // New window was created
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
pub async fn ide_window_will_close(
    _app: AppHandle,
    window_label: String,
    has_project: bool,
) -> Result<(), String> {
    info!(
        "Window {} will close, has_project: {} - will spawn welcome: {}",
        window_label, has_project, has_project
    );

    // Unregister from window registry
    unregister_window(&window_label);

    SHOULD_SPAWN_WELCOME.store(has_project, Ordering::SeqCst);
    Ok(())
}

/// Creates a new window with optional project context and geometry
pub fn create_window(
    app: &AppHandle,
    project: Option<(&str, &str, &str)>,
    geometry: Option<&WindowGeometry>,
) -> Result<String, Box<dyn std::error::Error>> {
    // Generate unique window label
    let label = format!("window-{}", uuid::Uuid::new_v4());

    // Build URL based on whether we have a project
    // - Project windows use index.html with URL params
    // - Welcome windows use welcome.html (separate lightweight entry)
    let (url, window_title, project_path) = match project {
        Some((project_id, project_path, project_name)) => {
            info!("Creating window for project: {}", project_name);
            let encoded_path = urlencoding::encode(project_path);
            let encoded_name = urlencoding::encode(project_name);
            let url = format!(
                "index.html?projectId={}&projectPath={}&projectName={}",
                project_id, encoded_path, encoded_name
            );
            (url, project_name.to_string(), Some(project_path.to_string()))
        }
        None => {
            info!("Creating welcome window");
            ("welcome.html".to_string(), "Glide".to_string(), None)
        }
    };

    // Use provided geometry or defaults
    let (width, height) = geometry
        .map(|g| (g.width, g.height))
        .unwrap_or((1400.0, 900.0));

    let webview_url = WebviewUrl::App(url.into());
    let mut builder = WebviewWindowBuilder::new(app, &label, webview_url)
        .title(&window_title)
        .inner_size(width, height)
        .min_inner_size(800.0, 600.0)
        .transparent(true)
        .decorations(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        // Set CSP to allow Monaco Editor workers (blob: URLs) and eval
        .on_web_resource_request(|_request, response| {
            response.headers_mut().insert(
                "Content-Security-Policy",
                PERMISSIVE_CSP.parse().unwrap(),
            );
        });

    // Set position if provided
    if let Some(g) = geometry {
        builder = builder.position(g.x, g.y);
    }

    let window = builder.build()?;

    // Set maximized state after build if needed
    if let Some(g) = geometry {
        if g.is_maximized {
            let _ = window.maximize();
        }
    }

    // Register window in the registry
    register_window(&label, project_path.as_deref());

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

    Ok(label)
}
