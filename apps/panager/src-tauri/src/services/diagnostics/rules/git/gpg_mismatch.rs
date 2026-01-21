//! GPG signing mismatch rule.
//!
//! Checks if project's GPG signing configuration explicitly differs from scope settings.
//! Only warns when a project EXPLICITLY overrides GPG config (not when it inherits from scope).

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use regex::Regex;
use std::fs;
use std::path::Path;

pub struct GpgMismatchRule;

/// Result of reading explicit GPG config from a project
struct ProjectExplicitGpgConfig {
    /// Whether gpgsign is explicitly set in the config (Some(true/false)) or not set (None)
    gpg_sign_explicit: Option<bool>,
    /// The signing key if explicitly set
    signing_key: Option<String>,
}

/// Read only explicitly set GPG configuration from a project's .git/config
/// Returns None values when config keys are not present (meaning they inherit from scope/global)
fn read_project_explicit_gpg_config(project_path: &str) -> Result<ProjectExplicitGpgConfig, String> {
    let git_config_path = Path::new(project_path).join(".git").join("config");
    if !git_config_path.exists() {
        return Err("No .git/config found".to_string());
    }

    let content = fs::read_to_string(&git_config_path).map_err(|e| e.to_string())?;

    let gpg_true_regex = Regex::new(r#"(?i)^\s*gpgsign\s*=\s*(true|1|yes)\s*$"#).map_err(|e| e.to_string())?;
    let gpg_false_regex = Regex::new(r#"(?i)^\s*gpgsign\s*=\s*(false|0|no)\s*$"#).map_err(|e| e.to_string())?;
    let signingkey_regex = Regex::new(r#"^\s*signingkey\s*=\s*(.+)$"#).map_err(|e| e.to_string())?;

    let mut gpg_sign_explicit = None;
    let mut signing_key = None;
    let mut in_user_section = false;
    let mut in_commit_section = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('[') {
            in_user_section = trimmed.to_lowercase().starts_with("[user");
            in_commit_section = trimmed.to_lowercase().starts_with("[commit");
            continue;
        }

        // Check for explicit gpgsign setting
        if in_commit_section {
            if gpg_true_regex.is_match(trimmed) {
                gpg_sign_explicit = Some(true);
            } else if gpg_false_regex.is_match(trimmed) {
                gpg_sign_explicit = Some(false);
            }
        }

        // Check for explicit signing key
        if in_user_section {
            if let Some(caps) = signingkey_regex.captures(trimmed) {
                signing_key = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
        }
    }

    Ok(ProjectExplicitGpgConfig {
        gpg_sign_explicit,
        signing_key,
    })
}

impl DiagnosticRule for GpgMismatchRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "git/gpg-mismatch",
            "GPG Signing Mismatch",
            "Project explicitly overrides GPG signing configuration from scope",
            true,
            Severity::Warning,
            Some("max_git_integration"),
            false,
        )
    }

    fn check(
        &self,
        db: &Database,
        scope: &Scope,
        projects: &[ProjectWithStatus],
    ) -> Result<Vec<DiagnosticIssue>, String> {
        let mut issues = Vec::new();

        // Get scope's expected git identity (includes GPG config)
        let scope_config = match crate::git::config::get_scope_git_identity_internal(db, &scope.id)?
        {
            Some(config) => config,
            None => return Ok(issues), // No config set, nothing to check
        };

        for project in projects {
            // Skip temp projects
            if project.project.is_temp {
                continue;
            }

            // Get project's explicit GPG config (not inherited values)
            let project_path = &project.project.path;
            let project_gpg = match read_project_explicit_gpg_config(project_path) {
                Ok(config) => config,
                Err(_) => continue, // Skip if can't read config
            };

            // Case 1: Project explicitly disables GPG signing when scope expects it enabled
            if scope_config.gpg_sign {
                if let Some(false) = project_gpg.gpg_sign_explicit {
                    issues.push(
                        DiagnosticIssue::new(
                            scope.id.clone(),
                            Some(project.project.id.clone()),
                            "git/gpg-mismatch".to_string(),
                            Severity::Warning,
                            "GPG signing explicitly disabled".to_string(),
                            format!(
                                "Project '{}' explicitly disables GPG signing but scope expects it enabled",
                                project.project.name
                            ),
                        )
                        .with_values(
                            Some("enabled".to_string()),
                            Some("disabled".to_string()),
                        ),
                    );
                }
            }

            // Case 2: Project explicitly enables GPG when scope has it disabled
            // This is less common but worth noting
            if !scope_config.gpg_sign {
                if let Some(true) = project_gpg.gpg_sign_explicit {
                    issues.push(
                        DiagnosticIssue::new(
                            scope.id.clone(),
                            Some(project.project.id.clone()),
                            "git/gpg-mismatch".to_string(),
                            Severity::Info, // Info level since enabling signing is usually good
                            "GPG signing explicitly enabled".to_string(),
                            format!(
                                "Project '{}' explicitly enables GPG signing (scope has it disabled)",
                                project.project.name
                            ),
                        )
                        .with_values(
                            Some("disabled".to_string()),
                            Some("enabled".to_string()),
                        ),
                    );
                }
            }

            // Case 3: Project has a different signing key than scope expects
            if let Some(expected_key) = &scope_config.signing_key {
                if let Some(actual_key) = &project_gpg.signing_key {
                    if expected_key != actual_key {
                        issues.push(
                            DiagnosticIssue::new(
                                scope.id.clone(),
                                Some(project.project.id.clone()),
                                "git/gpg-mismatch".to_string(),
                                Severity::Warning,
                                "Different GPG signing key".to_string(),
                                format!(
                                    "Project '{}' uses signing key '{}' but scope expects '{}'",
                                    project.project.name, actual_key, expected_key
                                ),
                            )
                            .with_values(Some(expected_key.clone()), Some(actual_key.clone())),
                        );
                    }
                }
            }
        }

        Ok(issues)
    }
}
