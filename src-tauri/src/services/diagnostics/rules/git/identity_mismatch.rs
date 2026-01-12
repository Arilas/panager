//! Git identity mismatch rule.
//!
//! Checks if project's git user.name/user.email matches the scope's expected config.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct IdentityMismatchRule;

impl DiagnosticRule for IdentityMismatchRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "git/identity-mismatch",
            "Identity Mismatch",
            "Git user.name or user.email differs from the scope's expected configuration",
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

        // Get scope's expected git identity
        let scope_config = match crate::git::config::get_scope_git_identity_internal(db, &scope.id)?
        {
            Some(config) => config,
            None => return Ok(issues), // No config set, nothing to check
        };

        for project in projects {
            // Skip if project is temp
            if project.project.is_temp {
                continue;
            }

            // Get project's actual git config
            let project_path = &project.project.path;
            let project_config = match crate::git::config::read_project_git_config(project_path) {
                Ok(config) => config,
                Err(_) => continue, // Skip if can't read config
            };

            // Check user.name
            if let Some(expected_name) = &scope_config.user_name {
                if let Some(actual_name) = &project_config.user_name {
                    if expected_name != actual_name {
                        issues.push(
                            DiagnosticIssue::new(
                                scope.id.clone(),
                                Some(project.project.id.clone()),
                                "git/identity-mismatch".to_string(),
                                Severity::Warning,
                                "Git user.name mismatch".to_string(),
                                format!(
                                    "Project '{}' has user.name '{}' but scope expects '{}'",
                                    project.project.name, actual_name, expected_name
                                ),
                            )
                            .with_values(Some(expected_name.to_string()), Some(actual_name.to_string())),
                        );
                    }
                }
            }

            // Check user.email
            if let Some(expected_email) = &scope_config.user_email {
                if let Some(actual_email) = &project_config.user_email {
                    if expected_email != actual_email {
                        issues.push(
                            DiagnosticIssue::new(
                                scope.id.clone(),
                                Some(project.project.id.clone()),
                                "git/identity-mismatch".to_string(),
                                Severity::Warning,
                                "Git user.email mismatch".to_string(),
                                format!(
                                    "Project '{}' has user.email '{}' but scope expects '{}'",
                                    project.project.name, actual_email, expected_email
                                ),
                            )
                            .with_values(Some(expected_email.to_string()), Some(actual_email.to_string())),
                        );
                    }
                }
            }
        }

        Ok(issues)
    }
}
