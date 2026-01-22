//! Insecure remote rule.
//!
//! Checks if remote URL uses HTTP instead of HTTPS or SSH.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct InsecureRemoteRule;

impl DiagnosticRule for InsecureRemoteRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "security/insecure-remote",
            "Insecure Remote",
            "Remote URL uses HTTP instead of HTTPS or SSH",
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

            // Check git status for remote URL
            if let Some(ref status) = project.git_status {
                if let Some(ref remote_url) = status.remote_url {
                    // Check if URL starts with http:// (not https://)
                    if remote_url.starts_with("http://") {
                        issues.push(
                            DiagnosticIssue::new(
                                scope.id.clone(),
                                Some(project.project.id.clone()),
                                "security/insecure-remote".to_string(),
                                Severity::Warning,
                                "Insecure Remote URL".to_string(),
                                format!(
                                    "Project '{}' uses insecure HTTP remote: {}",
                                    project.project.name, remote_url
                                ),
                            )
                            .with_values(
                                Some("https:// or git@".to_string()),
                                Some(remote_url.clone()),
                            ),
                        );
                    }
                }
            }
        }

        Ok(issues)
    }
}
