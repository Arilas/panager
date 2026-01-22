//! File system watcher service for IDE
//!
//! Uses the `notify` crate to watch for file system changes and emit events
//! to the appropriate IDE window.
//!
//! Respects .gitignore patterns - events for ignored files are filtered out.

use crate::ide::commands::files::{build_gitignore_matcher, is_path_gitignored};
use crate::ide::types::IdeFileEvent;
use ignore::gitignore::Gitignore;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tracing::{debug, error, info};

/// Global registry of active watchers
static WATCHERS: Lazy<Arc<Mutex<HashMap<String, WatcherHandle>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

/// Check if a path should be ignored based on gitignore rules
fn should_ignore_path(path: &Path, gitignore: &Option<Gitignore>) -> bool {
    // Always ignore .git directory
    if path.components().any(|c| c.as_os_str() == ".git") {
        return true;
    }

    // Check gitignore patterns (including ancestor paths)
    is_path_gitignored(path, gitignore)
}

/// Starts a file system watcher for a project
pub async fn start_watcher(
    app: AppHandle,
    window_label: String,
    project_path: String,
) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().await;

    // Stop existing watcher if any
    if watchers.contains_key(&window_label) {
        info!("Replacing existing watcher for {}", window_label);
        watchers.remove(&window_label);
    }

    let app_clone = app.clone();
    let window_label_clone = window_label.clone();

    // Build gitignore matcher for filtering events
    let project_path_buf = PathBuf::from(&project_path);
    let gitignore = build_gitignore_matcher(&project_path_buf);

    // Create the watcher
    let watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            match result {
                Ok(event) => {
                    // Get the first path from the event
                    let Some(event_path) = event.paths.first() else {
                        return;
                    };

                    // Filter out gitignored files and .git directory
                    if should_ignore_path(event_path, &gitignore) {
                        return;
                    }

                    // Convert to IDE event
                    let ide_event = match event.kind {
                        EventKind::Create(_) => Some(IdeFileEvent::Created {
                            path: event_path.to_string_lossy().to_string(),
                        }),
                        EventKind::Remove(_) => Some(IdeFileEvent::Deleted {
                            path: event_path.to_string_lossy().to_string(),
                        }),
                        EventKind::Modify(_) => Some(IdeFileEvent::Modified {
                            path: event_path.to_string_lossy().to_string(),
                        }),
                        _ => None,
                    };

                    if let Some(ide_event) = ide_event {
                        // Emit to the specific window
                        if let Some(window) = app_clone.get_webview_window(&window_label_clone) {
                            if let Err(e) = window.emit("ide-file-event", &ide_event) {
                                error!("Failed to emit file event: {}", e);
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Watch error: {}", e);
                }
            }
        },
        Config::default().with_poll_interval(Duration::from_millis(500)),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching
    let path = Path::new(&project_path);
    let mut watcher = watcher;
    watcher
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    watchers.insert(
        window_label,
        WatcherHandle { _watcher: watcher },
    );

    info!("Started watching: {}", project_path);
    Ok(())
}

/// Stops a file system watcher
pub async fn stop_watcher(_app: AppHandle, window_label: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().await;

    if watchers.remove(&window_label).is_some() {
        info!("Stopped watcher for: {}", window_label);
    } else {
        debug!("No watcher found for: {}", window_label);
    }

    Ok(())
}
