//! Background diagnostics service.
//!
//! This service runs periodic diagnostic scans based on the configured interval.

use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::db::Database;
use crate::events::EventBus;

use super::scanner::DiagnosticsScanner;
use super::state::DiagnosticsServiceState;

/// Default scan interval (5 minutes).
const DEFAULT_SCAN_INTERVAL_MS: u64 = 300_000;

/// Start the diagnostics background service.
pub async fn start_diagnostics_service(app_handle: AppHandle) {
    let state = match app_handle.try_state::<DiagnosticsServiceState>() {
        Some(s) => s,
        None => {
            tracing::error!("DiagnosticsServiceState not found");
            return;
        }
    };

    // Check if already running
    {
        let mut running = state.running.lock().await;
        if *running {
            tracing::warn!("Diagnostics service already running");
            return;
        }
        *running = true;
    }

    let running = state.running.clone();
    let scanning = state.scanning.clone();

    tracing::info!("Starting diagnostics background service");

    // Run initial scan on startup (after a short delay to let other services start)
    tokio::time::sleep(Duration::from_secs(5)).await;

    if let Err(e) = run_scan(&app_handle, &scanning).await {
        tracing::error!("Error during initial diagnostics scan: {}", e);
    }

    // Main loop
    loop {
        // Get configured scan interval
        let interval_ms = get_scan_interval(&app_handle).unwrap_or(DEFAULT_SCAN_INTERVAL_MS);

        tokio::time::sleep(Duration::from_millis(interval_ms)).await;

        {
            let is_running = running.lock().await;
            if !*is_running {
                tracing::info!("Diagnostics service stopped");
                break;
            }
        }

        // Check if diagnostics are enabled
        if !is_diagnostics_enabled(&app_handle) {
            continue;
        }

        if let Err(e) = run_scan(&app_handle, &scanning).await {
            tracing::error!("Error during diagnostics scan: {}", e);
        }
    }
}

/// Run a full diagnostic scan of all scopes.
async fn run_scan(
    app_handle: &AppHandle,
    scanning: &std::sync::Arc<tokio::sync::Mutex<bool>>,
) -> Result<(), String> {
    // Check if already scanning
    {
        let mut is_scanning = scanning.lock().await;
        if *is_scanning {
            tracing::debug!("Diagnostics scan already in progress, skipping");
            return Ok(());
        }
        *is_scanning = true;
    }

    let db = app_handle.state::<Database>();
    let scanner = DiagnosticsScanner::new();

    let result = scanner.scan_all_scopes(&db);

    // Emit events for updated scopes
    if let Ok(ref results) = result {
        if let Some(event_bus) = app_handle.try_state::<EventBus>() {
            for scan_result in results {
                event_bus.emit(crate::events::AppEvent::DiagnosticsUpdated {
                    scope_id: scan_result.scope_id.clone(),
                });
            }
        }

        let total_issues: usize = results.iter().map(|r| r.issues_found).sum();
        let total_duration: u64 = results.iter().map(|r| r.duration_ms).sum();
        tracing::debug!(
            "Diagnostics scan complete: {} scopes, {} total issues, {}ms",
            results.len(),
            total_issues,
            total_duration
        );
    }

    // Release scanning lock
    {
        let mut is_scanning = scanning.lock().await;
        *is_scanning = false;
    }

    result.map(|_| ())
}

/// Get the configured scan interval from settings.
fn get_scan_interval(app_handle: &AppHandle) -> Option<u64> {
    let db = app_handle.try_state::<Database>()?;
    let conn = db.conn.lock().ok()?;

    conn.query_row(
        "SELECT value FROM settings WHERE key = 'diagnostics_scan_interval'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|v| v.parse().ok())
}

/// Check if diagnostics are enabled in settings.
fn is_diagnostics_enabled(app_handle: &AppHandle) -> bool {
    let db = match app_handle.try_state::<Database>() {
        Some(db) => db,
        None => return true, // Default to enabled if can't check
    };

    let conn = match db.conn.lock() {
        Ok(conn) => conn,
        Err(_) => return true,
    };

    conn.query_row(
        "SELECT value FROM settings WHERE key = 'diagnostics_enabled'",
        [],
        |row| row.get::<_, String>(0),
    )
    .map(|v| v == "true")
    .unwrap_or(true) // Default to enabled
}

/// Stop the diagnostics service.
pub async fn stop_diagnostics_service(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<DiagnosticsServiceState>() {
        let mut running = state.running.lock().await;
        *running = false;
    }
}
