//! Missing git identity rule.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct MissingIdentityRule;

impl DiagnosticRule for MissingIdentityRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "git/missing-identity",
            "Missing Git Identity",
            "Scope has a default folder configured but no git identity",
            true,
            Severity::Warning,
            Some("max_git_integration"),
            true, // Scope-level rule
        )
    }

    fn check(
        &self,
        db: &Database,
        scope: &Scope,
        _projects: &[ProjectWithStatus],
    ) -> Result<Vec<DiagnosticIssue>, String> {
        let mut issues = Vec::new();

        // Only check if scope has a default folder
        if scope.default_folder.is_none() {
            return Ok(issues);
        }

        // Check if scope has git identity configured
        let identity = crate::git::config::get_scope_git_identity_internal(db, &scope.id)?;

        if identity.is_none() {
            issues.push(DiagnosticIssue::new(
                scope.id.clone(),
                None,
                "git/missing-identity".to_string(),
                Severity::Warning,
                "Missing Git Identity".to_string(),
                format!(
                    "Scope '{}' has a default folder but no git identity configured. Configure a git identity to enable identity verification for projects.",
                    scope.name
                ),
            ));
        }

        Ok(issues)
    }
}
