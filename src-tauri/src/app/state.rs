//! Application state initialization
//!
//! This module handles initializing and managing application state,
//! including the database and background service states.

use crate::db::Database;
use crate::events::EventBus;
use crate::plugins::PluginHost;
use crate::services::cleanup::CleanupServiceState;
use crate::services::diagnostics::DiagnosticsServiceState;
use crate::services::folder_scanner::FolderScanServiceState;
use std::sync::Arc;
use tauri::{App, Manager};

/// Initialize all managed state for the application
pub fn init_state(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize database
    let database = Database::new().expect("Failed to initialize database");
    app.manage(database);

    // Initialize event bus
    app.manage(EventBus::new());

    // Initialize cleanup service state
    app.manage(CleanupServiceState::default());

    // Initialize folder scan service state
    app.manage(FolderScanServiceState::default());

    // Initialize diagnostics service state
    app.manage(DiagnosticsServiceState::default());

    // Initialize plugin host
    let plugin_host = Arc::new(PluginHost::new());
    app.manage(plugin_host);

    Ok(())
}

/// Run startup tasks that depend on state being initialized
pub fn run_startup_tasks(app: &App) {
    // Sync editors on startup
    if app.try_state::<Database>().is_some() {
        let _ = crate::commands::editors::detect_editors();
    }

    // Validate git config caches on startup
    if let Some(db) = app.try_state::<Database>() {
        let _ = crate::git::config::validate_git_config_caches(&db);
    }
}

/// Start background services
pub fn start_background_services(app: &App) {
    // Start event handlers (must be started before other services that emit events)
    crate::events::start_event_handlers(app.handle().clone());

    // Start cleanup service
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        crate::services::cleanup::start_cleanup_service(app_handle).await;
    });

    // Start folder scan service
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        crate::services::folder_scanner::start_folder_scan_service(app_handle).await;
    });

    // Start diagnostics service
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        crate::services::diagnostics::start_diagnostics_service(app_handle).await;
    });

    // Start plugin host
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        start_plugin_host(app_handle).await;
    });
}

/// Initialize and start the plugin host
async fn start_plugin_host(app: tauri::AppHandle) {
    use crate::plugins::builtin;

    tracing::info!("Starting plugin host");

    let Some(host) = app.try_state::<Arc<PluginHost>>() else {
        tracing::error!("Plugin host not initialized");
        return;
    };

    // Set the app handle so plugins can emit events to frontend
    host.set_app_handle(app.clone()).await;

    // Register built-in plugins
    builtin::register_builtin_plugins(&host).await;

    // Start the event forwarding loop
    host.start_event_loop().await;

    // Activate default plugins
    builtin::activate_default_plugins(&host).await;

    tracing::info!("Plugin host started");
}
