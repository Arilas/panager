//! File system watcher service for IDE
//!
//! Uses the `notify` crate to watch for file system changes and emit events
//! to the appropriate IDE window.

use crate::ide::types::IdeFileEvent;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::Path;
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
    let _project_path_clone = project_path.clone();

    // Create debounced event handler
    let (_tx, mut rx) = tokio::sync::mpsc::channel::<IdeFileEvent>(100);

    // Spawn event processor with debouncing
    let app_for_events = app.clone();
    let window_for_events = window_label.clone();
    tokio::spawn(async move {
        use std::collections::HashSet;
        use tokio::time::{interval, Duration};

        let mut pending_events: HashSet<String> = HashSet::new();
        let mut debounce_timer = interval(Duration::from_millis(100));

        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    // Collect events for debouncing
                    let path = match &event {
                        IdeFileEvent::Created { path } => path.clone(),
                        IdeFileEvent::Deleted { path } => path.clone(),
                        IdeFileEvent::Modified { path } => path.clone(),
                        IdeFileEvent::Renamed { new_path, .. } => new_path.clone(),
                    };

                    // Store the event path (will be processed on next tick)
                    pending_events.insert(format!("{:?}:{}", event, path));

                    // Emit immediately for creates/deletes, debounce modifies
                    match &event {
                        IdeFileEvent::Created { .. } | IdeFileEvent::Deleted { .. } | IdeFileEvent::Renamed { .. } => {
                            if let Some(window) = app_for_events.get_webview_window(&window_for_events) {
                                if let Err(e) = window.emit("ide-file-event", &event) {
                                    error!("Failed to emit file event: {}", e);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                _ = debounce_timer.tick() => {
                    // Process debounced modification events
                    // (This is a simplified version - in production you'd want more sophisticated debouncing)
                }
            }
        }
    });

    // Create the watcher
    let watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            match result {
                Ok(event) => {
                    // Filter out irrelevant events
                    let ide_event = match event.kind {
                        EventKind::Create(_) => {
                            event.paths.first().map(|p| IdeFileEvent::Created {
                                path: p.to_string_lossy().to_string(),
                            })
                        }
                        EventKind::Remove(_) => {
                            event.paths.first().map(|p| IdeFileEvent::Deleted {
                                path: p.to_string_lossy().to_string(),
                            })
                        }
                        EventKind::Modify(_) => {
                            event.paths.first().map(|p| IdeFileEvent::Modified {
                                path: p.to_string_lossy().to_string(),
                            })
                        }
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
