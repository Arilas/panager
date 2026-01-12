//! Diverged from remote rule.
//!
//! Checks if local and remote branches have diverged.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct DivergedFromRemoteRule;

impl DiagnosticRule for DivergedFromRemoteRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "repo/diverged-from-remote",
            "Diverged from Remote",
            "Local and remote branches have diverged",
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

            // Check git status for divergence (both ahead and behind)
            if let Some(ref status) = project.git_status {
                if status.ahead > 0 && status.behind > 0 {
                    issues.push(DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "repo/diverged-from-remote".to_string(),
                        Severity::Warning,
                        "Diverged from Remote".to_string(),
                        format!(
                            "Project '{}' has diverged: {} commit{} ahead, {} commit{} behind",
                            project.project.name,
                            status.ahead,
                            if status.ahead == 1 { "" } else { "s" },
                            status.behind,
                            if status.behind == 1 { "" } else { "s" }
                        ),
                    ));
                }
            }
        }

        Ok(issues)
    }
}
