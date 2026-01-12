//! Unpushed commits rule.
//!
//! Checks if project has local commits that haven't been pushed to remote.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct UnpushedCommitsRule;

impl DiagnosticRule for UnpushedCommitsRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "repo/unpushed-commits",
            "Unpushed Commits",
            "Local commits have not been pushed to remote",
            true,
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

            // Check git status for unpushed commits
            if let Some(ref status) = project.git_status {
                if status.ahead > 0 {
                    issues.push(DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "repo/unpushed-commits".to_string(),
                        Severity::Info,
                        "Unpushed Commits".to_string(),
                        format!(
                            "Project '{}' has {} unpushed commit{}",
                            project.project.name,
                            status.ahead,
                            if status.ahead == 1 { "" } else { "s" }
                        ),
                    ));
                }
            }
        }

        Ok(issues)
    }
}
