//! Merge conflicts rule.
//!
//! Checks if repository has unresolved merge conflicts.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::process::Command;

pub struct MergeConflictsRule;

impl DiagnosticRule for MergeConflictsRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "repo/merge-conflicts",
            "Merge Conflicts",
            "Unresolved merge conflicts detected",
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

            // Check for merge conflicts using git
            let output = Command::new("git")
                .args(["diff", "--name-only", "--diff-filter=U"])
                .current_dir(&project.project.path)
                .output();

            if let Ok(output) = output {
                if output.status.success() {
                    let conflicted_files = String::from_utf8_lossy(&output.stdout);
                    let count = conflicted_files.lines().filter(|l| !l.is_empty()).count();

                    if count > 0 {
                        issues.push(DiagnosticIssue::new(
                            scope.id.clone(),
                            Some(project.project.id.clone()),
                            "repo/merge-conflicts".to_string(),
                            Severity::Error,
                            "Merge Conflicts".to_string(),
                            format!(
                                "Project '{}' has {} conflicted file{}",
                                project.project.name,
                                count,
                                if count == 1 { "" } else { "s" }
                            ),
                        ));
                    }
                }
            }
        }

        Ok(issues)
    }
}
