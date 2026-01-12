//! Diagnostics event handler.
//!
//! This handler listens to application events and triggers diagnostic scans
//! when relevant changes occur. It reacts to:
//! - Project changes (add, remove, move, path change)
//! - Scope configuration changes (default folder, git identity, SSH alias)
//! - Max feature toggles (enable/disable rules)

use crate::db::Database;
use crate::events::{AppEvent, EventBus};
use crate::services::diagnostics::repository::DiagnosticsRepository;
use crate::services::diagnostics::scanner::DiagnosticsScanner;
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast;

/// Start the diagnostics event handler.
///
/// This handler listens to the event bus and triggers appropriate diagnostic
/// actions in response to application events.
pub fn start_handler(app_handle: AppHandle, mut receiver: broadcast::Receiver<AppEvent>) {
    tracing::debug!("Starting diagnostics event handler");

    tauri::async_runtime::spawn(async move {
        let scanner = DiagnosticsScanner::new();

        loop {
            match receiver.recv().await {
                Ok(event) => {
                    if let Err(e) = handle_event(&app_handle, &scanner, event).await {
                        tracing::error!("Diagnostics handler error: {}", e);
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!("Diagnostics handler lagged {} events", n);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    tracing::info!("Event bus closed, stopping diagnostics handler");
                    break;
                }
            }
        }
    });
}

/// Handle a single event.
async fn handle_event(
    app: &AppHandle,
    scanner: &DiagnosticsScanner,
    event: AppEvent,
) -> Result<(), String> {
    let db = app.state::<Database>();

    match event {
        // =========================================================================
        // Project Events
        // =========================================================================
        AppEvent::ProjectAdded {
            project_id,
            scope_id,
        } => {
            // Scan the newly added project
            tracing::debug!(
                "Scanning diagnostics for added project {} in scope {}",
                project_id,
                scope_id
            );
            scanner.scan_project(&db, &scope_id, &project_id)?;
            emit_diagnostics_updated(app, &scope_id);
        }

        AppEvent::ProjectRemoved {
            project_id,
            scope_id,
        } => {
            // Remove diagnostics for the deleted project
            tracing::debug!("Removing diagnostics for deleted project {}", project_id);
            DiagnosticsRepository::delete_project_diagnostics(&db, &project_id)?;
            emit_diagnostics_updated(app, &scope_id);
        }

        AppEvent::ProjectMoved {
            project_id,
            old_scope_id,
            new_scope_id,
        } => {
            // Move diagnostics to new scope and re-scan
            tracing::debug!(
                "Moving diagnostics for project {} from scope {} to {}",
                project_id,
                old_scope_id,
                new_scope_id
            );
            DiagnosticsRepository::move_project_diagnostics(&db, &project_id, &new_scope_id)?;
            scanner.scan_project(&db, &new_scope_id, &project_id)?;
            emit_diagnostics_updated(app, &old_scope_id);
            emit_diagnostics_updated(app, &new_scope_id);
        }

        AppEvent::ProjectPathChanged {
            project_id,
            scope_id,
            ..
        }
        | AppEvent::ProjectGitStatusChanged {
            project_id,
            scope_id,
        } => {
            tracing::debug!("Re-scanning diagnostics for project {}", project_id);
            scanner.scan_project(&db, &scope_id, &project_id)?;
            emit_diagnostics_updated(app, &scope_id);
        }

        // =========================================================================
        // Scope Events - re-scan entire scope when config changes
        // =========================================================================
        AppEvent::ScopeCreated { scope_id }
        | AppEvent::ScopeDefaultFolderChanged { scope_id, .. }
        | AppEvent::ScopeGitIdentityChanged { scope_id }
        | AppEvent::ScopeSshAliasChanged { scope_id }
        | AppEvent::FolderScanCompleted { scope_id, .. } => {
            tracing::debug!("Re-scanning diagnostics for scope {}", scope_id);
            scanner.scan_scope(&db, &scope_id)?;
            emit_diagnostics_updated(app, &scope_id);
        }

        AppEvent::ScopeDeleted { scope_id } => {
            // Diagnostics are deleted via cascade in DB
            tracing::debug!("Scope {} deleted, diagnostics cascade deleted", scope_id);
        }

        // =========================================================================
        // Settings Events
        // =========================================================================
        AppEvent::MaxFeatureToggled { feature, enabled } => {
            tracing::info!(
                "Max feature '{}' {}, updating diagnostics",
                feature,
                if enabled { "enabled" } else { "disabled" }
            );

            if enabled {
                scanner.scan_feature_rules(&db, &feature)?;
            } else {
                scanner.clear_feature_diagnostics(&db, &feature)?;
            }

            emit_all_diagnostics_updated(app)?;
        }

        AppEvent::SettingChanged { key, .. } => {
            if matches!(key.as_str(), "diagnostics_enabled" | "diagnostics_scan_interval") {
                tracing::debug!("Diagnostics setting '{}' changed", key);
            }
        }

        // =========================================================================
        // Diagnostics Events (output events, don't handle)
        // =========================================================================
        AppEvent::DiagnosticsUpdated { .. } | AppEvent::DiagnosticsCleared { .. } => {
            // These are output events from this handler, don't process
        }
    }

    Ok(())
}

/// Emit a DiagnosticsUpdated event for a scope.
fn emit_diagnostics_updated(app: &AppHandle, scope_id: &str) {
    if let Some(event_bus) = app.try_state::<EventBus>() {
        event_bus.emit(AppEvent::DiagnosticsUpdated {
            scope_id: scope_id.to_string(),
        });
    }
}

/// Emit DiagnosticsUpdated events for all scopes.
fn emit_all_diagnostics_updated(app: &AppHandle) -> Result<(), String> {
    let db = app.state::<Database>();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id FROM scopes")
        .map_err(|e| e.to_string())?;

    let scope_ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);
    drop(conn);

    for scope_id in scope_ids {
        emit_diagnostics_updated(app, &scope_id);
    }

    Ok(())
}
