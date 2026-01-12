//! Diagnostics scanner that orchestrates rule execution.
//!
//! The scanner is responsible for:
//! - Running diagnostic rules against scopes and projects
//! - Managing which rules are enabled based on settings
//! - Persisting scan results to the database

use std::collections::{HashMap, HashSet};
use std::time::Instant;

use crate::db::repository::{project_repo, scope_repo};
use crate::db::Database;

use super::models::{DiagnosticIssue, RuleMetadata};
use super::repository::DiagnosticsRepository;
use super::rules::{DiagnosticRule, RuleRegistry};

/// Scanner for running diagnostic rules.
pub struct DiagnosticsScanner {
    registry: RuleRegistry,
}

/// Context for determining which rules should run.
struct ScanContext<'a> {
    disabled_rule_ids: HashSet<&'a str>,
    max_git_enabled: bool,
    max_ssh_enabled: bool,
}

impl<'a> ScanContext<'a> {
    /// Check if a rule should be skipped based on context.
    fn should_skip_rule(&self, rule: &dyn DiagnosticRule) -> bool {
        let metadata = rule.metadata();

        // Skip disabled rules
        if self.disabled_rule_ids.contains(metadata.id.as_str()) {
            return true;
        }

        // Skip rules that aren't enabled by default
        if !metadata.default_enabled {
            return true;
        }

        // Skip rules that require a Max feature that isn't enabled
        if let Some(required_feature) = &metadata.required_feature {
            let feature_enabled = match required_feature.as_str() {
                "max_git_integration" => self.max_git_enabled,
                "max_ssh_integration" => self.max_ssh_enabled,
                _ => true,
            };
            if !feature_enabled {
                return true;
            }
        }

        false
    }
}

impl Default for DiagnosticsScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl DiagnosticsScanner {
    /// Create a new scanner with the default rule registry.
    pub fn new() -> Self {
        Self {
            registry: RuleRegistry::new(),
        }
    }

    /// Get all rule metadata.
    pub fn get_rule_metadata(&self) -> Vec<RuleMetadata> {
        self.registry.metadata()
    }

    /// Build scan context for a scope.
    fn build_scan_context<'a>(
        db: &Database,
        scope_id: &str,
        disabled_rules: &'a [super::models::DisabledRule],
    ) -> Result<ScanContext<'a>, String> {
        let disabled_rule_ids: HashSet<&str> = disabled_rules
            .iter()
            .filter(|r| r.scope_id.is_none() || r.scope_id.as_deref() == Some(scope_id))
            .map(|r| r.rule_id.as_str())
            .collect();

        let settings = get_settings(db)?;
        let max_git_enabled = settings.get("max_git_integration").map(|v| v == "true").unwrap_or(false);
        let max_ssh_enabled = settings.get("max_ssh_integration").map(|v| v == "true").unwrap_or(false);

        Ok(ScanContext {
            disabled_rule_ids,
            max_git_enabled,
            max_ssh_enabled,
        })
    }

    /// Scan a single scope for diagnostic issues.
    ///
    /// This runs all enabled rules against the scope and its projects,
    /// then stores the results in the database.
    pub fn scan_scope(&self, db: &Database, scope_id: &str) -> Result<ScanResult, String> {
        let start = Instant::now();

        // Get the scope
        let scope = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            scope_repo::find_scope_by_id(&conn, scope_id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| format!("Scope not found: {}", scope_id))?
        };

        // Get projects for this scope
        let projects = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            project_repo::fetch_projects_with_status(&conn, Some(scope_id))
                .map_err(|e| e.to_string())?
        };

        // Build scan context
        let disabled_rules = DiagnosticsRepository::get_disabled_rules(db)?;
        let ctx = Self::build_scan_context(db, scope_id, &disabled_rules)?;

        // Run all enabled rules
        let mut all_issues = Vec::new();
        let mut rules_run = 0;

        for rule in self.registry.all() {
            if ctx.should_skip_rule(rule.as_ref()) {
                continue;
            }

            match rule.check(db, &scope, &projects) {
                Ok(issues) => {
                    all_issues.extend(issues);
                    rules_run += 1;
                }
                Err(e) => {
                    tracing::warn!("Rule {} failed for scope {}: {}", rule.metadata().id, scope_id, e);
                }
            }
        }

        // Clear old issues and save new ones
        self.sync_issues(db, scope_id, &all_issues)?;

        let duration = start.elapsed();

        // Update scan state
        DiagnosticsRepository::update_scan_state(
            db,
            scope_id,
            duration.as_millis() as i64,
            all_issues.len() as i32,
        )?;

        Ok(ScanResult {
            scope_id: scope_id.to_string(),
            issues_found: all_issues.len(),
            rules_run,
            duration_ms: duration.as_millis() as u64,
        })
    }

    /// Scan all scopes.
    pub fn scan_all_scopes(&self, db: &Database) -> Result<Vec<ScanResult>, String> {
        // Get all scopes
        let scopes = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            scope_repo::fetch_all_scopes_with_links(&conn).map_err(|e| e.to_string())?
        };

        let mut results = Vec::new();
        for scope_with_links in scopes {
            match self.scan_scope(db, &scope_with_links.scope.id) {
                Ok(result) => results.push(result),
                Err(e) => {
                    tracing::error!("Failed to scan scope {}: {}", scope_with_links.scope.name, e);
                }
            }
        }

        Ok(results)
    }

    /// Scan a specific project within a scope.
    ///
    /// This is more efficient than scanning the whole scope when only
    /// one project needs to be checked (e.g., after adding a project).
    pub fn scan_project(
        &self,
        db: &Database,
        scope_id: &str,
        project_id: &str,
    ) -> Result<Vec<DiagnosticIssue>, String> {
        // Get the scope
        let scope = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            scope_repo::find_scope_by_id(&conn, scope_id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| format!("Scope not found: {}", scope_id))?
        };

        // Get just this project
        let projects = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let all_projects = project_repo::fetch_projects_with_status(&conn, Some(scope_id))
                .map_err(|e| e.to_string())?;
            all_projects
                .into_iter()
                .filter(|p| p.project.id == project_id)
                .collect::<Vec<_>>()
        };

        if projects.is_empty() {
            return Ok(Vec::new());
        }

        // Build scan context
        let disabled_rules = DiagnosticsRepository::get_disabled_rules(db)?;
        let ctx = Self::build_scan_context(db, scope_id, &disabled_rules)?;

        // Run project-level rules only
        let mut issues = Vec::new();
        for rule in self.registry.project_level() {
            if ctx.should_skip_rule(rule) {
                continue;
            }

            match rule.check(db, &scope, &projects) {
                Ok(new_issues) => {
                    issues.extend(new_issues);
                }
                Err(e) => {
                    tracing::warn!("Rule {} failed for project {}: {}", rule.metadata().id, project_id, e);
                }
            }
        }

        // Sync issues for this project only
        self.sync_project_issues(db, scope_id, project_id, &issues)?;

        Ok(issues)
    }

    /// Scan a specific rule across all relevant scopes.
    ///
    /// Useful when a Max feature is enabled and we need to run all
    /// rules that depend on that feature.
    pub fn scan_rule(&self, db: &Database, rule_id: &str) -> Result<(), String> {
        let rule = self
            .registry
            .get(rule_id)
            .ok_or_else(|| format!("Rule not found: {}", rule_id))?;

        // Get all scopes
        let scopes = {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            scope_repo::fetch_all_scopes_with_links(&conn).map_err(|e| e.to_string())?
        };

        for scope_with_links in scopes {
            let scope = &scope_with_links.scope;

            // Get projects for this scope
            let projects = {
                let conn = db.conn.lock().map_err(|e| e.to_string())?;
                project_repo::fetch_projects_with_status(&conn, Some(&scope.id))
                    .map_err(|e| e.to_string())?
            };

            match rule.check(db, scope, &projects) {
                Ok(issues) => {
                    // Remove old issues for this rule and add new ones
                    self.sync_rule_issues(db, &scope.id, rule_id, &issues)?;
                }
                Err(e) => {
                    tracing::warn!("Rule {} failed for scope {}: {}", rule_id, scope.id, e);
                }
            }
        }

        Ok(())
    }

    /// Clear all diagnostics for rules that depend on a specific feature.
    pub fn clear_feature_diagnostics(&self, db: &Database, feature: &str) -> Result<(), String> {
        let rules = self.registry.by_feature(feature);
        for rule in rules {
            let rule_id = rule.metadata().id;
            DiagnosticsRepository::delete_rule_diagnostics(db, &rule_id)?;
        }
        Ok(())
    }

    /// Scan all rules that depend on a specific feature.
    pub fn scan_feature_rules(&self, db: &Database, feature: &str) -> Result<(), String> {
        let rules = self.registry.by_feature(feature);
        for rule in rules {
            let rule_id = rule.metadata().id;
            self.scan_rule(db, &rule_id)?;
        }
        Ok(())
    }

    /// Sync issues for a scope - preserves dismissed state and removes stale issues.
    fn sync_issues(
        &self,
        db: &Database,
        scope_id: &str,
        new_issues: &[DiagnosticIssue],
    ) -> Result<(), String> {
        let existing = DiagnosticsRepository::get_scope_diagnostics(db, scope_id, true)?;
        sync_issues_internal(db, existing, new_issues)
    }

    /// Sync issues for a single project.
    fn sync_project_issues(
        &self,
        db: &Database,
        scope_id: &str,
        project_id: &str,
        new_issues: &[DiagnosticIssue],
    ) -> Result<(), String> {
        let existing = DiagnosticsRepository::get_scope_diagnostics(db, scope_id, true)?;
        let existing_filtered: Vec<_> = existing
            .into_iter()
            .filter(|i| i.project_id.as_deref() == Some(project_id))
            .collect();
        sync_issues_internal(db, existing_filtered, new_issues)
    }

    /// Sync issues for a single rule across a scope.
    fn sync_rule_issues(
        &self,
        db: &Database,
        scope_id: &str,
        rule_id: &str,
        new_issues: &[DiagnosticIssue],
    ) -> Result<(), String> {
        let existing = DiagnosticsRepository::get_scope_diagnostics(db, scope_id, true)?;
        let existing_filtered: Vec<_> = existing
            .into_iter()
            .filter(|i| i.rule_id == rule_id)
            .collect();
        sync_issues_internal(db, existing_filtered, new_issues)
    }
}

/// Result of a diagnostic scan.
#[derive(Debug, Clone)]
pub struct ScanResult {
    pub scope_id: String,
    pub issues_found: usize,
    pub rules_run: usize,
    pub duration_ms: u64,
}

/// Create a unique key for an issue.
fn make_issue_key(scope_id: &str, project_id: Option<&str>, rule_id: &str) -> String {
    format!("{}:{}:{}", scope_id, project_id.unwrap_or("scope"), rule_id)
}

/// Sync issues - preserves dismissed state and removes stale issues.
fn sync_issues_internal(
    db: &Database,
    existing: Vec<DiagnosticIssue>,
    new_issues: &[DiagnosticIssue],
) -> Result<(), String> {
    // Build map of existing issues keyed by scope:project:rule
    let existing_map: HashMap<String, DiagnosticIssue> = existing
        .into_iter()
        .map(|i| {
            let key = make_issue_key(&i.scope_id, i.project_id.as_deref(), &i.rule_id);
            (key, i)
        })
        .collect();

    let mut seen_keys = HashSet::new();

    // Upsert new issues, preserving dismissed state from existing
    for issue in new_issues {
        let key = make_issue_key(&issue.scope_id, issue.project_id.as_deref(), &issue.rule_id);
        seen_keys.insert(key.clone());

        let mut issue_to_save = issue.clone();
        if let Some(existing_issue) = existing_map.get(&key) {
            issue_to_save.dismissed = existing_issue.dismissed;
            issue_to_save.id = existing_issue.id.clone();
            issue_to_save.created_at = existing_issue.created_at;
        }

        DiagnosticsRepository::upsert_issue(db, &issue_to_save)?;
    }

    // Remove issues that no longer exist (but keep dismissed ones)
    for (key, existing_issue) in &existing_map {
        if !seen_keys.contains(key) && !existing_issue.dismissed {
            DiagnosticsRepository::delete_issue(db, &existing_issue.id)?;
        }
    }

    Ok(())
}

/// Get settings from the database.
fn get_settings(db: &Database) -> Result<HashMap<String, String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let settings = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(settings)
}
