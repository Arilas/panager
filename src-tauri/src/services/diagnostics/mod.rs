//! Diagnostics service for detecting and reporting configuration issues.
//!
//! This module provides a rule-based diagnostics system that:
//! - Scans scopes and projects for configuration issues
//! - Persists diagnostic results to the database
//! - Provides fix capabilities for common issues
//! - Integrates with the event bus for reactive updates
//!
//! # Architecture
//!
//! The diagnostics system consists of:
//! - **Models**: Core types (DiagnosticIssue, Severity, RuleGroup)
//! - **Repository**: Database operations for storing/retrieving diagnostics
//! - **Rules**: Individual diagnostic rules organized by group
//! - **Scanner**: Orchestrates rule execution across scopes/projects
//! - **Service**: Background service for periodic scanning
//!
//! # Rule Naming
//!
//! Rules follow a namespaced pattern: `{group}/{rule-name}`
//! - `git/*` - Git configuration and identity
//! - `repo/*` - Repository health and state
//! - `project/*` - Project structure and organization
//! - `security/*` - Security-related checks

pub mod models;
pub mod repository;
pub mod rules;
pub mod scanner;
pub mod service;
pub mod state;

// Re-export commonly used types
pub use models::{
    DiagnosticFix, DiagnosticIssue, DisabledRule, RuleGroup, RuleMetadata, ScanState, Severity,
    ScopeDiagnosticsSummary,
};
pub use repository::DiagnosticsRepository;
pub use rules::DiagnosticRule;
pub use scanner::DiagnosticsScanner;
pub use service::start_diagnostics_service;
pub use state::DiagnosticsServiceState;

use crate::db::Database;
use crate::events::{AppEvent, EventBus};
use tauri::State;

// =========================================================================
// Tauri Commands
// =========================================================================

/// Get all diagnostic issues for a scope.
#[tauri::command]
#[specta::specta]
pub fn get_scope_diagnostics(
    db: State<Database>,
    scope_id: String,
    include_dismissed: bool,
) -> Result<Vec<DiagnosticIssue>, String> {
    DiagnosticsRepository::get_scope_diagnostics(&db, &scope_id, include_dismissed)
}

/// Get diagnostics summary for all scopes.
#[tauri::command]
#[specta::specta]
pub fn get_diagnostics_summaries(db: State<Database>) -> Result<Vec<ScopeDiagnosticsSummary>, String> {
    DiagnosticsRepository::get_all_summaries(&db)
}

/// Get diagnostics summary for a specific scope.
#[tauri::command]
#[specta::specta]
pub fn get_scope_diagnostics_summary(
    db: State<Database>,
    scope_id: String,
) -> Result<ScopeDiagnosticsSummary, String> {
    DiagnosticsRepository::get_scope_summary(&db, &scope_id)
}

/// Manually trigger a diagnostics scan for a scope.
#[tauri::command]
#[specta::specta]
pub fn scan_scope_diagnostics(
    db: State<Database>,
    event_bus: State<EventBus>,
    scope_id: String,
) -> Result<ScanState, String> {
    let scanner = DiagnosticsScanner::new();
    scanner.scan_scope(&db, &scope_id)?;

    // Emit update event
    event_bus.emit(AppEvent::DiagnosticsUpdated {
        scope_id: scope_id.clone(),
    });

    // Return the updated scan state
    DiagnosticsRepository::get_scan_state(&db, &scope_id)?
        .ok_or_else(|| "Failed to get scan state".to_string())
}

/// Dismiss a diagnostic issue.
#[tauri::command]
#[specta::specta]
pub fn dismiss_diagnostic(
    db: State<Database>,
    event_bus: State<EventBus>,
    issue_id: String,
) -> Result<(), String> {
    // Get the issue to find its scope
    let issue = DiagnosticsRepository::get_issue(&db, &issue_id)?
        .ok_or_else(|| "Issue not found".to_string())?;

    DiagnosticsRepository::dismiss_issue(&db, &issue_id)?;

    // Emit update event
    event_bus.emit(AppEvent::DiagnosticsUpdated {
        scope_id: issue.scope_id,
    });

    Ok(())
}

/// Undismiss a diagnostic issue.
#[tauri::command]
#[specta::specta]
pub fn undismiss_diagnostic(
    db: State<Database>,
    event_bus: State<EventBus>,
    issue_id: String,
) -> Result<(), String> {
    // Get the issue to find its scope
    let issue = DiagnosticsRepository::get_issue(&db, &issue_id)?
        .ok_or_else(|| "Issue not found".to_string())?;

    DiagnosticsRepository::undismiss_issue(&db, &issue_id)?;

    // Emit update event
    event_bus.emit(AppEvent::DiagnosticsUpdated {
        scope_id: issue.scope_id,
    });

    Ok(())
}

/// Disable a diagnostic rule globally or for a specific scope.
#[tauri::command]
#[specta::specta]
pub fn disable_diagnostic_rule(
    db: State<Database>,
    rule_id: String,
    scope_id: Option<String>,
) -> Result<(), String> {
    DiagnosticsRepository::disable_rule(&db, &rule_id, scope_id.as_deref())
}

/// Enable a diagnostic rule.
#[tauri::command]
#[specta::specta]
pub fn enable_diagnostic_rule(
    db: State<Database>,
    rule_id: String,
    scope_id: Option<String>,
) -> Result<(), String> {
    DiagnosticsRepository::enable_rule(&db, &rule_id, scope_id.as_deref())
}

/// Get all disabled diagnostic rules.
#[tauri::command]
#[specta::specta]
pub fn get_disabled_diagnostic_rules(db: State<Database>) -> Result<Vec<DisabledRule>, String> {
    DiagnosticsRepository::get_disabled_rules(&db)
}

/// Get metadata for all diagnostic rules.
#[tauri::command]
#[specta::specta]
pub fn get_diagnostic_rule_metadata() -> Vec<RuleMetadata> {
    let scanner = DiagnosticsScanner::new();
    scanner.get_rule_metadata()
}

/// Fix a diagnostic issue using the specified fix type.
#[tauri::command]
#[specta::specta]
pub fn fix_diagnostic_issue(
    db: State<Database>,
    event_bus: State<EventBus>,
    fix: DiagnosticFix,
) -> Result<(), String> {
    // Get the issue
    let issue = DiagnosticsRepository::get_issue(&db, &fix.issue_id)?
        .ok_or_else(|| "Issue not found".to_string())?;

    // Apply the fix based on rule type and fix type
    match (issue.rule_id.as_str(), fix.fix_type.as_str()) {
        // Git identity fixes
        ("git/identity-mismatch", "apply_name") | ("git/identity-mismatch", "apply_email") => {
            apply_git_config_fix(&db, &issue, &fix)?;
        }

        // GPG signing fixes
        ("git/gpg-mismatch", "apply_gpg") => {
            apply_git_config_fix(&db, &issue, &fix)?;
        }
        ("git/gpg-mismatch", "remove_gpg") => {
            // Remove the explicit gpgsign setting to inherit from scope
            if let Some(project_id) = &issue.project_id {
                let project_path = get_project_path(&db, project_id)?;
                let output = std::process::Command::new("git")
                    .args(["config", "--local", "--unset", "commit.gpgsign"])
                    .current_dir(&project_path)
                    .output()
                    .map_err(|e| e.to_string())?;

                // --unset returns error if key doesn't exist, which is fine
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    // Only fail if it's not a "key not found" error
                    if !stderr.contains("key not found") && !stderr.is_empty() {
                        return Err(stderr.to_string());
                    }
                }
            }
        }

        // SSH remote fix
        ("git/ssh-remote-mismatch", "update_remote") => {
            if let Some(project_id) = &issue.project_id {
                let conn = db.conn.lock().map_err(|e| e.to_string())?;

                // Get project path and scope's SSH alias
                let (project_path, scope_id): (String, String) = conn
                    .query_row(
                        "SELECT path, scope_id FROM projects WHERE id = ?1",
                        [project_id],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .map_err(|e| e.to_string())?;

                let expected_alias: String = conn
                    .query_row(
                        "SELECT ssh_alias FROM scopes WHERE id = ?1",
                        [&scope_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;

                drop(conn);

                // Get current remote URL
                let output = std::process::Command::new("git")
                    .args(["remote", "get-url", "origin"])
                    .current_dir(&project_path)
                    .output()
                    .map_err(|e| e.to_string())?;

                if !output.status.success() {
                    return Err("Failed to get remote URL".to_string());
                }

                let current_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let new_url = replace_ssh_host_in_url(&current_url, &expected_alias)?;

                // Update the remote
                let output = std::process::Command::new("git")
                    .args(["remote", "set-url", "origin", &new_url])
                    .current_dir(&project_path)
                    .output()
                    .map_err(|e| e.to_string())?;

                if !output.status.success() {
                    return Err(String::from_utf8_lossy(&output.stderr).to_string());
                }
            }
        }

        // Move project to scope folder
        ("project/outside-folder", "move_to_folder") => {
            if let Some(project_id) = &issue.project_id {
                // Use the existing move function
                crate::services::folder_scanner::move_project_to_scope_folder_internal(&db, project_id)?;
            }
        }

        // Push changes
        ("repo/unpushed-commits", "push_changes") => {
            if let Some(project_id) = &issue.project_id {
                let project_path = get_project_path(&db, project_id)?;

                let output = std::process::Command::new("git")
                    .args(["push"])
                    .current_dir(&project_path)
                    .output()
                    .map_err(|e| e.to_string())?;

                if !output.status.success() {
                    return Err(String::from_utf8_lossy(&output.stderr).to_string());
                }
            }
        }

        // Checkout main branch
        ("repo/detached-head", "checkout_main") => {
            if let Some(project_id) = &issue.project_id {
                let project_path = get_project_path(&db, project_id)?;

                // Try common main branch names
                for branch in ["main", "master", "develop"] {
                    let output = std::process::Command::new("git")
                        .args(["checkout", branch])
                        .current_dir(&project_path)
                        .output()
                        .map_err(|e| e.to_string())?;

                    if output.status.success() {
                        break;
                    }
                }
            }
        }

        _ => {
            return Err(format!(
                "No automatic fix available for rule '{}' with fix type '{}'",
                issue.rule_id, fix.fix_type
            ));
        }
    }

    // Delete the issue after fixing
    DiagnosticsRepository::delete_issue(&db, &fix.issue_id)?;

    // Emit update event
    event_bus.emit(AppEvent::DiagnosticsUpdated {
        scope_id: issue.scope_id,
    });

    Ok(())
}

/// Helper to get project path from database
fn get_project_path(db: &Database, project_id: &str) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT path FROM projects WHERE id = ?1",
        [project_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Helper to apply git config fix
fn apply_git_config_fix(db: &Database, issue: &DiagnosticIssue, fix: &DiagnosticFix) -> Result<(), String> {
    if let (Some(project_id), Some(expected)) = (&issue.project_id, &issue.expected_value) {
        let project_path = get_project_path(db, project_id)?;

        // Determine the config key from the fix type
        let config_key = match fix.fix_type.as_str() {
            "apply_name" => "user.name",
            "apply_email" => "user.email",
            "apply_gpg" => "commit.gpgsign",
            _ => return Err("Unknown fix type".to_string()),
        };

        // Use git command to set config
        let output = std::process::Command::new("git")
            .args(["config", "--local", config_key, expected])
            .current_dir(&project_path)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    }
    Ok(())
}

/// Replace the SSH host in a git URL
fn replace_ssh_host_in_url(url: &str, new_host: &str) -> Result<String, String> {
    // Handle SSH URL format: git@host:user/repo.git
    if let Some(stripped) = url.strip_prefix("git@") {
        if let Some(colon_pos) = stripped.find(':') {
            let path = &stripped[colon_pos..];
            return Ok(format!("git@{}{}", new_host, path));
        }
    }

    // Handle SSH URL format: ssh://git@host/path
    if url.starts_with("ssh://") {
        if let Some(at_pos) = url.find('@') {
            let after_at = &url[at_pos + 1..];
            if let Some(slash_pos) = after_at.find('/') {
                let path = &after_at[slash_pos..];
                return Ok(format!("ssh://git@{}{}", new_host, path));
            }
        }
    }

    Err(format!("Could not parse URL format: {}", url))
}
