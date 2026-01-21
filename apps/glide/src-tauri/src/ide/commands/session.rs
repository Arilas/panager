//! Session Management for Glide
//!
//! Persists and restores window states across app launches.
//! Stores window geometry (position, size) and project context.

use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::sync::RwLock;
use tracing::{info, warn};

const SESSION_FILE: &str = "app-session.json";

/// Window geometry (position and size)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WindowGeometry {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_maximized: bool,
}

impl Default for WindowGeometry {
    fn default() -> Self {
        Self {
            x: 100.0,
            y: 100.0,
            width: 1400.0,
            height: 900.0,
            is_maximized: false,
        }
    }
}

/// State of a single window
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub window_label: String,
    pub project_id: String,
    pub project_path: String,
    pub project_name: String,
    pub geometry: WindowGeometry,
}

/// Full app session containing all window states
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSession {
    pub windows: Vec<WindowState>,
    pub last_updated: Option<DateTime<Utc>>,
}

/// In-memory cache of the session for quick updates
static SESSION_CACHE: Lazy<RwLock<AppSession>> = Lazy::new(|| RwLock::new(AppSession::default()));

/// Get the path to the session file
fn get_session_path() -> Result<PathBuf, String> {
    let config_dir = directories::ProjectDirs::from("com", "krona", "glide")
        .ok_or("Failed to get config directory")?
        .config_dir()
        .to_path_buf();

    // Ensure directory exists
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    Ok(config_dir.join(SESSION_FILE))
}

/// Load session from disk into cache
fn load_session_from_disk() -> Result<AppSession, String> {
    let path = get_session_path()?;

    if !path.exists() {
        return Ok(AppSession::default());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse session file: {}", e))
}

/// Save session cache to disk
fn save_session_to_disk(session: &AppSession) -> Result<(), String> {
    let path = get_session_path()?;

    let content = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    std::fs::write(&path, content).map_err(|e| format!("Failed to write session file: {}", e))
}

/// Initialize session cache from disk (called on app start)
pub fn init_session_cache() -> Result<(), String> {
    let session = load_session_from_disk()?;
    let mut cache = SESSION_CACHE
        .write()
        .map_err(|_| "Failed to acquire session cache lock")?;
    *cache = session;
    Ok(())
}

/// Load session (returns cached version, initializing from disk if needed)
#[tauri::command]
#[specta::specta]
pub fn ide_load_session() -> Result<AppSession, String> {
    // Try to read from cache first
    if let Ok(cache) = SESSION_CACHE.read() {
        // If cache has windows or was explicitly loaded, return it
        if !cache.windows.is_empty() || cache.last_updated.is_some() {
            return Ok(cache.clone());
        }
    }

    // Otherwise load from disk and cache it
    let session = load_session_from_disk()?;

    if let Ok(mut cache) = SESSION_CACHE.write() {
        *cache = session.clone();
    }

    Ok(session)
}

/// Save a window's state to the session
#[tauri::command]
#[specta::specta]
pub fn ide_save_window_state(
    window_label: String,
    project_id: String,
    project_path: String,
    project_name: String,
    geometry: WindowGeometry,
) -> Result<(), String> {
    info!(
        "Saving window state: {} -> {} ({})",
        window_label, project_name, project_path
    );

    let mut cache = SESSION_CACHE
        .write()
        .map_err(|_| "Failed to acquire session cache lock")?;

    // Remove existing entry for this window label (if any)
    cache.windows.retain(|w| w.window_label != window_label);

    // Add new state
    cache.windows.push(WindowState {
        window_label,
        project_id,
        project_path,
        project_name,
        geometry,
    });

    cache.last_updated = Some(Utc::now());

    // Persist to disk
    save_session_to_disk(&cache)
}

/// Remove a window from the session (called when window closes)
#[tauri::command]
#[specta::specta]
pub fn ide_remove_window_state(window_label: String) -> Result<(), String> {
    info!("Removing window state: {}", window_label);

    let mut cache = SESSION_CACHE
        .write()
        .map_err(|_| "Failed to acquire session cache lock")?;

    let count_before = cache.windows.len();
    cache.windows.retain(|w| w.window_label != window_label);
    let count_after = cache.windows.len();

    info!(
        "Window removal: {} -> {} windows (removed {})",
        count_before,
        count_after,
        count_before - count_after
    );

    cache.last_updated = Some(Utc::now());

    // Persist to disk
    let result = save_session_to_disk(&cache);
    if result.is_ok() {
        info!("Session saved to disk after removing window");
    }
    result
}

/// Update only the geometry of a window (for move/resize events)
#[tauri::command]
#[specta::specta]
pub fn ide_update_window_geometry(window_label: String, geometry: WindowGeometry) -> Result<(), String> {
    let mut cache = SESSION_CACHE
        .write()
        .map_err(|_| "Failed to acquire session cache lock")?;

    // Find and update the window's geometry
    if let Some(window) = cache.windows.iter_mut().find(|w| w.window_label == window_label) {
        window.geometry = geometry;
        cache.last_updated = Some(Utc::now());

        // Persist to disk
        save_session_to_disk(&cache)
    } else {
        // Window not in session yet - this is fine, it might be a welcome window
        Ok(())
    }
}

/// Clear all session data
#[tauri::command]
#[specta::specta]
pub fn ide_clear_session() -> Result<(), String> {
    info!("Clearing session");

    let mut cache = SESSION_CACHE
        .write()
        .map_err(|_| "Failed to acquire session cache lock")?;

    cache.windows.clear();
    cache.last_updated = Some(Utc::now());

    save_session_to_disk(&cache)
}

/// Get valid windows from session (filters out deleted projects, validates geometry)
pub fn get_restorable_windows() -> Result<Vec<WindowState>, String> {
    let session = ide_load_session()?;

    let valid_windows: Vec<WindowState> = session
        .windows
        .into_iter()
        .filter(|w| {
            // Check if project still exists
            let exists = std::path::Path::new(&w.project_path).exists();
            if !exists {
                warn!(
                    "Skipping window for deleted project: {} ({})",
                    w.project_name, w.project_path
                );
            }
            exists
        })
        .map(|mut w| {
            // Validate geometry - ensure window is on a visible screen
            // For now, just ensure reasonable bounds
            if w.geometry.x < -1000.0 || w.geometry.y < -1000.0 {
                warn!(
                    "Window {} has invalid position ({}, {}), resetting to default",
                    w.window_label, w.geometry.x, w.geometry.y
                );
                w.geometry.x = 100.0;
                w.geometry.y = 100.0;
            }
            if w.geometry.width < 400.0 {
                w.geometry.width = 1400.0;
            }
            if w.geometry.height < 300.0 {
                w.geometry.height = 900.0;
            }
            w
        })
        .collect();

    Ok(valid_windows)
}
