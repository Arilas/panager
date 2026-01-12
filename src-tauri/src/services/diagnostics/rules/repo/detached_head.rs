//! Detached HEAD rule.
//!
//! Checks if repository is in detached HEAD state.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::process::Command;

pub struct DetachedHeadRule;

impl DiagnosticRule for DetachedHeadRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "repo/detached-head",
            "Detached HEAD",
            "Repository is in detached HEAD state",
            false, // Opt-in
            Severity::Warning,
            None,
            false,
        )
    }

    fn check(
        &self,
        _db: &Database,
        scope: &Scope,
        projects: &[ProjectWithStatus],
    ) -> Result<Vec<DiagnosticIssue>, String> {
        let mut issues = Vec::new();

        for project in projects {
            // Skip temp projects
            if project.project.is_temp {
                continue;
            }

            // Check for detached HEAD using git
            let output = Command::new("git")
                .args(["symbolic-ref", "-q", "HEAD"])
                .current_dir(&project.project.path)
                .output();

            if let Ok(output) = output {
                // If the command fails (exit code non-zero), we're in detached HEAD
                if !output.status.success() {
                    // Get the current commit hash
                    let commit = Command::new("git")
                        .args(["rev-parse", "--short", "HEAD"])
                        .current_dir(&project.project.path)
                        .output()
                        .ok()
                        .and_then(|o| String::from_utf8(o.stdout).ok())
                        .map(|s| s.trim().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    issues.push(DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "repo/detached-head".to_string(),
                        Severity::Warning,
                        "Detached HEAD".to_string(),
                        format!(
                            "Project '{}' is in detached HEAD state at commit {}",
                            project.project.name, commit
                        ),
                    ));
                }
            }
        }

        Ok(issues)
    }
}
