//! Incomplete identity for GPG signing rule.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};

pub struct IncompleteIdentityForGpgRule;

impl DiagnosticRule for IncompleteIdentityForGpgRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "git/incomplete-identity-for-gpg",
            "Incomplete Identity for GPG",
            "GPG signing is enabled but git identity (name/email) is not fully configured",
            true,
            Severity::Error,
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

        // Get scope's git config
        let config = match crate::git::config::get_scope_git_identity_internal(db, &scope.id)? {
            Some(config) => config,
            None => return Ok(issues),
        };

        // Check if GPG signing is enabled
        if !config.gpg_sign {
            return Ok(issues);
        }

        // Check if identity is complete
        let has_name = config.user_name.as_ref().is_some_and(|n| !n.is_empty());
        let has_email = config.user_email.as_ref().is_some_and(|e| !e.is_empty());

        if !has_name || !has_email {
            let missing = match (has_name, has_email) {
                (false, false) => "user.name and user.email",
                (false, true) => "user.name",
                (true, false) => "user.email",
                _ => unreachable!(),
            };

            issues.push(DiagnosticIssue::new(
                scope.id.clone(),
                None,
                "git/incomplete-identity-for-gpg".to_string(),
                Severity::Error,
                "Incomplete Identity for GPG Signing".to_string(),
                format!(
                    "Scope '{}' has GPG signing enabled but is missing {}. Commits will fail without a complete identity.",
                    scope.name, missing
                ),
            ));
        }

        Ok(issues)
    }
}
