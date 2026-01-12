//! Empty repository rule.
//!
//! Checks if repository has no commits.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::process::Command;

pub struct EmptyRepositoryRule;

impl DiagnosticRule for EmptyRepositoryRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "project/empty-repository",
            "Empty Repository",
            "Repository has no commits",
            false, // Opt-in
            Severity::Info,
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

            // Check if repository has any commits using git
            let output = Command::new("git")
                .args(["rev-parse", "HEAD"])
                .current_dir(&project.project.path)
                .output();

            if let Ok(output) = output {
                // If git rev-parse HEAD fails, the repository has no commits
                if !output.status.success() {
                    issues.push(DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "project/empty-repository".to_string(),
                        Severity::Info,
                        "Empty Repository".to_string(),
                        format!("Project '{}' has no commits yet", project.project.name),
                    ));
                }
            }
        }

        Ok(issues)
    }
}
