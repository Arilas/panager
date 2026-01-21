//! Database repository for diagnostics.
//!
//! Handles all CRUD operations for diagnostic issues, disabled rules, and scan state.

use crate::db::Database;
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Row};

use super::models::{
    DiagnosticIssue, DisabledRule, ScanState, ScopeDiagnosticsSummary, Severity,
};

/// Repository for diagnostics database operations.
pub struct DiagnosticsRepository;

/// Parse a database row into a DiagnosticIssue.
fn parse_diagnostic_issue(row: &Row) -> rusqlite::Result<DiagnosticIssue> {
    Ok(DiagnosticIssue {
        id: row.get(0)?,
        scope_id: row.get(1)?,
        project_id: row.get(2)?,
        rule_id: row.get(3)?,
        severity: Severity::parse(&row.get::<_, String>(4)?).unwrap_or(Severity::Info),
        title: row.get(5)?,
        description: row.get(6)?,
        expected_value: row.get(7)?,
        actual_value: row.get(8)?,
        metadata: row
            .get::<_, Option<String>>(9)?
            .and_then(|s| serde_json::from_str(&s).ok()),
        dismissed: row.get::<_, i32>(10)? != 0,
        created_at: row
            .get::<_, String>(11)?
            .parse()
            .unwrap_or_else(|_| Utc::now()),
        updated_at: row
            .get::<_, String>(12)?
            .parse()
            .unwrap_or_else(|_| Utc::now()),
    })
}

impl DiagnosticsRepository {
    // =========================================================================
    // Diagnostic Issues
    // =========================================================================

    /// Get all diagnostics for a scope.
    pub fn get_scope_diagnostics(
        db: &Database,
        scope_id: &str,
        include_dismissed: bool,
    ) -> Result<Vec<DiagnosticIssue>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let sql = if include_dismissed {
            "SELECT id, scope_id, project_id, rule_id, severity, title, description,
                    expected_value, actual_value, metadata, dismissed, created_at, updated_at
             FROM diagnostics WHERE scope_id = ?1
             ORDER BY
                CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                created_at DESC"
        } else {
            "SELECT id, scope_id, project_id, rule_id, severity, title, description,
                    expected_value, actual_value, metadata, dismissed, created_at, updated_at
             FROM diagnostics WHERE scope_id = ?1 AND dismissed = 0
             ORDER BY
                CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                created_at DESC"
        };

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

        let issues = stmt
            .query_map(params![scope_id], parse_diagnostic_issue)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(issues)
    }

    /// Get a single diagnostic issue by ID.
    pub fn get_issue(db: &Database, issue_id: &str) -> Result<Option<DiagnosticIssue>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let issue = conn
            .query_row(
                "SELECT id, scope_id, project_id, rule_id, severity, title, description,
                        expected_value, actual_value, metadata, dismissed, created_at, updated_at
                 FROM diagnostics WHERE id = ?1",
                params![issue_id],
                parse_diagnostic_issue,
            )
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(issue)
    }

    /// Upsert a diagnostic issue (insert or update if exists).
    pub fn upsert_issue(db: &Database, issue: &DiagnosticIssue) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let metadata_json = issue
            .metadata
            .as_ref()
            .map(|m| serde_json::to_string(m).unwrap_or_default());

        conn.execute(
            "INSERT INTO diagnostics (id, scope_id, project_id, rule_id, severity, title,
                                      description, expected_value, actual_value, metadata,
                                      dismissed, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(scope_id, project_id, rule_id) DO UPDATE SET
                severity = excluded.severity,
                title = excluded.title,
                description = excluded.description,
                expected_value = excluded.expected_value,
                actual_value = excluded.actual_value,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at",
            params![
                issue.id,
                issue.scope_id,
                issue.project_id,
                issue.rule_id,
                issue.severity.as_str(),
                issue.title,
                issue.description,
                issue.expected_value,
                issue.actual_value,
                metadata_json,
                if issue.dismissed { 1 } else { 0 },
                issue.created_at.to_rfc3339(),
                issue.updated_at.to_rfc3339(),
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Delete a diagnostic issue.
    pub fn delete_issue(db: &Database, issue_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM diagnostics WHERE id = ?1", params![issue_id])
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Delete all diagnostics for a project.
    pub fn delete_project_diagnostics(db: &Database, project_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM diagnostics WHERE project_id = ?1",
            params![project_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Delete all diagnostics for a scope.
    pub fn delete_scope_diagnostics(db: &Database, scope_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM diagnostics WHERE scope_id = ?1",
            params![scope_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Delete diagnostics for a specific rule across all scopes.
    pub fn delete_rule_diagnostics(db: &Database, rule_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM diagnostics WHERE rule_id = ?1",
            params![rule_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Delete diagnostics for rules matching a prefix (e.g., "git/" to clear all git rules).
    pub fn delete_rule_prefix_diagnostics(db: &Database, prefix: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM diagnostics WHERE rule_id LIKE ?1",
            params![format!("{}%", prefix)],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Dismiss a diagnostic issue.
    pub fn dismiss_issue(db: &Database, issue_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE diagnostics SET dismissed = 1, updated_at = datetime('now') WHERE id = ?1",
            params![issue_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Undismiss a diagnostic issue.
    pub fn undismiss_issue(db: &Database, issue_id: &str) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE diagnostics SET dismissed = 0, updated_at = datetime('now') WHERE id = ?1",
            params![issue_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Move diagnostics when a project moves to a different scope.
    pub fn move_project_diagnostics(
        db: &Database,
        project_id: &str,
        new_scope_id: &str,
    ) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE diagnostics SET scope_id = ?1, updated_at = datetime('now') WHERE project_id = ?2",
            params![new_scope_id, project_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    // =========================================================================
    // Diagnostics Summary
    // =========================================================================

    /// Get diagnostics summary for all scopes.
    pub fn get_all_summaries(db: &Database) -> Result<Vec<ScopeDiagnosticsSummary>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    d.scope_id,
                    SUM(CASE WHEN d.severity = 'error' AND d.dismissed = 0 THEN 1 ELSE 0 END) as error_count,
                    SUM(CASE WHEN d.severity = 'warning' AND d.dismissed = 0 THEN 1 ELSE 0 END) as warning_count,
                    SUM(CASE WHEN d.severity = 'info' AND d.dismissed = 0 THEN 1 ELSE 0 END) as info_count,
                    SUM(CASE WHEN d.dismissed = 0 THEN 1 ELSE 0 END) as total_count,
                    s.last_scan_at
                 FROM diagnostics d
                 LEFT JOIN diagnostics_scan_state s ON d.scope_id = s.scope_id
                 GROUP BY d.scope_id",
            )
            .map_err(|e| e.to_string())?;

        let summaries = stmt
            .query_map([], |row| {
                Ok(ScopeDiagnosticsSummary {
                    scope_id: row.get(0)?,
                    error_count: row.get(1)?,
                    warning_count: row.get(2)?,
                    info_count: row.get(3)?,
                    total_count: row.get(4)?,
                    last_scan_at: row
                        .get::<_, Option<String>>(5)?
                        .and_then(|s| s.parse().ok()),
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(summaries)
    }

    /// Get diagnostics summary for a specific scope.
    pub fn get_scope_summary(
        db: &Database,
        scope_id: &str,
    ) -> Result<ScopeDiagnosticsSummary, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let summary = conn
            .query_row(
                "SELECT
                    ?1 as scope_id,
                    SUM(CASE WHEN severity = 'error' AND dismissed = 0 THEN 1 ELSE 0 END) as error_count,
                    SUM(CASE WHEN severity = 'warning' AND dismissed = 0 THEN 1 ELSE 0 END) as warning_count,
                    SUM(CASE WHEN severity = 'info' AND dismissed = 0 THEN 1 ELSE 0 END) as info_count,
                    SUM(CASE WHEN dismissed = 0 THEN 1 ELSE 0 END) as total_count,
                    (SELECT last_scan_at FROM diagnostics_scan_state WHERE scope_id = ?1) as last_scan_at
                 FROM diagnostics WHERE scope_id = ?1",
                params![scope_id],
                |row| {
                    Ok(ScopeDiagnosticsSummary {
                        scope_id: row.get(0)?,
                        error_count: row.get::<_, Option<i32>>(1)?.unwrap_or(0),
                        warning_count: row.get::<_, Option<i32>>(2)?.unwrap_or(0),
                        info_count: row.get::<_, Option<i32>>(3)?.unwrap_or(0),
                        total_count: row.get::<_, Option<i32>>(4)?.unwrap_or(0),
                        last_scan_at: row
                            .get::<_, Option<String>>(5)?
                            .and_then(|s| s.parse().ok()),
                    })
                },
            )
            .map_err(|e| e.to_string())?;

        Ok(summary)
    }

    // =========================================================================
    // Disabled Rules
    // =========================================================================

    /// Get all disabled rules.
    pub fn get_disabled_rules(db: &Database) -> Result<Vec<DisabledRule>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT id, scope_id, rule_id, created_at FROM disabled_diagnostic_rules")
            .map_err(|e| e.to_string())?;

        let rules = stmt
            .query_map([], |row| {
                Ok(DisabledRule {
                    id: row.get(0)?,
                    scope_id: row.get(1)?,
                    rule_id: row.get(2)?,
                    created_at: row
                        .get::<_, String>(3)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(rules)
    }

    /// Check if a rule is disabled (globally or for a specific scope).
    pub fn is_rule_disabled(
        db: &Database,
        rule_id: &str,
        scope_id: Option<&str>,
    ) -> Result<bool, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM disabled_diagnostic_rules
                 WHERE rule_id = ?1 AND (scope_id IS NULL OR scope_id = ?2)",
                params![rule_id, scope_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        Ok(count > 0)
    }

    /// Disable a rule (globally if scope_id is None).
    pub fn disable_rule(
        db: &Database,
        rule_id: &str,
        scope_id: Option<&str>,
    ) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT OR IGNORE INTO disabled_diagnostic_rules (id, scope_id, rule_id)
             VALUES (?1, ?2, ?3)",
            params![id, scope_id, rule_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Enable a rule (remove from disabled list).
    pub fn enable_rule(db: &Database, rule_id: &str, scope_id: Option<&str>) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        if scope_id.is_some() {
            conn.execute(
                "DELETE FROM disabled_diagnostic_rules WHERE rule_id = ?1 AND scope_id = ?2",
                params![rule_id, scope_id],
            )
        } else {
            conn.execute(
                "DELETE FROM disabled_diagnostic_rules WHERE rule_id = ?1 AND scope_id IS NULL",
                params![rule_id],
            )
        }
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    // =========================================================================
    // Scan State
    // =========================================================================

    /// Update scan state for a scope.
    pub fn update_scan_state(
        db: &Database,
        scope_id: &str,
        duration_ms: i64,
        issues_found: i32,
    ) -> Result<(), String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO diagnostics_scan_state (scope_id, last_scan_at, scan_duration_ms, issues_found)
             VALUES (?1, datetime('now'), ?2, ?3)
             ON CONFLICT(scope_id) DO UPDATE SET
                last_scan_at = datetime('now'),
                scan_duration_ms = excluded.scan_duration_ms,
                issues_found = excluded.issues_found",
            params![scope_id, duration_ms, issues_found],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Get scan state for a scope.
    pub fn get_scan_state(db: &Database, scope_id: &str) -> Result<Option<ScanState>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        let state = conn
            .query_row(
                "SELECT scope_id, last_scan_at, scan_duration_ms, issues_found
                 FROM diagnostics_scan_state WHERE scope_id = ?1",
                params![scope_id],
                |row| {
                    Ok(ScanState {
                        scope_id: row.get(0)?,
                        last_scan_at: row
                            .get::<_, Option<String>>(1)?
                            .and_then(|s| s.parse().ok()),
                        scan_duration_ms: row.get(2)?,
                        issues_found: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(state)
    }
}
