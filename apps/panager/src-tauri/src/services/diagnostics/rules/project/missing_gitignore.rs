//! Missing .gitignore rule.
//!
//! Checks if project is missing a .gitignore file.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::path::Path;

pub struct MissingGitignoreRule;

impl DiagnosticRule for MissingGitignoreRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "project/missing-gitignore",
            "Missing .gitignore",
            "No .gitignore file found in project root",
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

            let gitignore_path = Path::new(&project.project.path).join(".gitignore");

            if !gitignore_path.exists() {
                issues.push(DiagnosticIssue::new(
                    scope.id.clone(),
                    Some(project.project.id.clone()),
                    "project/missing-gitignore".to_string(),
                    Severity::Info,
                    "Missing .gitignore".to_string(),
                    format!(
                        "Project '{}' does not have a .gitignore file",
                        project.project.name
                    ),
                ));
            }
        }

        Ok(issues)
    }
}
