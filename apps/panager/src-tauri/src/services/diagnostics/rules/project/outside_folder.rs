//! Outside folder rule.
//!
//! Checks if project is located outside the scope's default folder.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::path::Path;

pub struct OutsideFolderRule;

impl DiagnosticRule for OutsideFolderRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "project/outside-folder",
            "Outside Scope Folder",
            "Project is not located in the scope's default folder",
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

        // Skip if scope doesn't have a default folder
        let default_folder = match &scope.default_folder {
            Some(folder) if !folder.is_empty() => folder,
            _ => return Ok(issues),
        };

        let default_folder_path = Path::new(default_folder);

        for project in projects {
            // Skip temp projects
            if project.project.is_temp {
                continue;
            }

            let project_path = Path::new(&project.project.path);

            // Check if project is inside the default folder
            if !project_path.starts_with(default_folder_path) {
                issues.push(DiagnosticIssue::new(
                    scope.id.clone(),
                    Some(project.project.id.clone()),
                    "project/outside-folder".to_string(),
                    Severity::Info,
                    "Outside Scope Folder".to_string(),
                    format!(
                        "Project '{}' is located outside the scope's default folder",
                        project.project.name
                    ),
                ).with_values(
                    Some(default_folder.clone()),
                    Some(project.project.path.clone()),
                ));
            }
        }

        Ok(issues)
    }
}
