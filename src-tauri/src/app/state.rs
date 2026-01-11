//! Application state initialization
//!
//! This module handles initializing and managing application state,
//! including the database and background service states.

use crate::db::Database;
use crate::services::cleanup::CleanupServiceState;
use crate::services::folder_scanner::FolderScanServiceState;
use tauri::{App, Manager};

/// Initialize all managed state for the application
pub fn init_state(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize database
    let database = Database::new().expect("Failed to initialize database");
    app.manage(database);

    // Initialize cleanup service state
    app.manage(CleanupServiceState::default());

    // Initialize folder scan service state
    app.manage(FolderScanServiceState::default());

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
}
