//! Env file tracked rule.
//!
//! Checks if .env files are tracked in git (potential security risk).

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::process::Command;

pub struct EnvFileTrackedRule;

impl DiagnosticRule for EnvFileTrackedRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "security/env-file-tracked",
            "Env File Tracked",
            ".env file is tracked in git (potential security risk)",
            false, // Opt-in
            Severity::Error,
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

            // Check if .env is tracked using git ls-files
            let output = Command::new("git")
                .args(["ls-files", ".env", ".env.local", ".env.production"])
                .current_dir(&project.project.path)
                .output();

            if let Ok(output) = output {
                let tracked_files = String::from_utf8_lossy(&output.stdout);
                if !tracked_files.trim().is_empty() {
                    let files: Vec<&str> = tracked_files.lines().collect();
                    issues.push(DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "security/env-file-tracked".to_string(),
                        Severity::Error,
                        "Env File Tracked".to_string(),
                        format!(
                            "Project '{}' has tracked env file{}: {}",
                            project.project.name,
                            if files.len() == 1 { "" } else { "s" },
                            files.join(", ")
                        ),
                    ));
                }
            }
        }

        Ok(issues)
    }
}
