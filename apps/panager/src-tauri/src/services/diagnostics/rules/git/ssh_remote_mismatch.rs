//! SSH remote URL mismatch rule.
//!
//! Checks if project's remote URL uses the scope's configured SSH alias.

use crate::db::models::{ProjectWithStatus, Scope};
use crate::db::Database;
use crate::services::diagnostics::models::{DiagnosticIssue, RuleMetadata, Severity};
use crate::services::diagnostics::rules::{rule_metadata, DiagnosticRule};
use std::process::Command;

pub struct SshRemoteMismatchRule;

impl DiagnosticRule for SshRemoteMismatchRule {
    fn metadata(&self) -> RuleMetadata {
        rule_metadata(
            "git/ssh-remote-mismatch",
            "SSH Remote Mismatch",
            "Remote URL doesn't use the scope's configured SSH alias",
            true,
            Severity::Warning,
            Some("max_ssh_integration"),
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

        // Get scope's expected SSH alias
        let expected_alias = match &scope.ssh_alias {
            Some(alias) if !alias.is_empty() => alias,
            _ => return Ok(issues), // No alias configured, nothing to check
        };

        for project in projects {
            // Skip temp projects
            if project.project.is_temp {
                continue;
            }

            // Get project's remote URL
            let remote_url = match get_remote_url(&project.project.path) {
                Ok(Some(url)) => url,
                _ => continue, // No remote or error, skip
            };

            // Check if it's an SSH URL and uses the expected alias
            // SSH URLs look like: git@alias:user/repo.git or ssh://git@alias/path
            let is_ssh_url = remote_url.starts_with("git@") || remote_url.starts_with("ssh://");

            if !is_ssh_url {
                // Not an SSH URL (could be HTTPS), skip
                continue;
            }

            // Check if URL contains the expected alias
            let uses_alias = remote_url.contains(&format!("@{}:", expected_alias))
                || remote_url.contains(&format!("@{}/", expected_alias));

            if !uses_alias {
                // Extract the actual host from the URL
                let actual_host = extract_host_from_url(&remote_url).unwrap_or_else(|| "unknown".to_string());

                issues.push(
                    DiagnosticIssue::new(
                        scope.id.clone(),
                        Some(project.project.id.clone()),
                        "git/ssh-remote-mismatch".to_string(),
                        Severity::Warning,
                        "SSH remote doesn't use expected alias".to_string(),
                        format!(
                            "Project '{}' uses '{}' but scope expects SSH alias '{}'",
                            project.project.name, actual_host, expected_alias
                        ),
                    )
                    .with_values(Some(expected_alias.clone()), Some(actual_host)),
                );
            }
        }

        Ok(issues)
    }
}

/// Get the remote URL for a git repository
fn get_remote_url(project_path: &str) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if url.is_empty() {
            Ok(None)
        } else {
            Ok(Some(url))
        }
    } else {
        Ok(None)
    }
}

/// Extract the host from an SSH URL
fn extract_host_from_url(url: &str) -> Option<String> {
    // Handle git@host:path format
    if let Some(stripped) = url.strip_prefix("git@") {
        if let Some(colon_pos) = stripped.find(':') {
            return Some(stripped[..colon_pos].to_string());
        }
    }

    // Handle ssh://git@host/path format
    if url.starts_with("ssh://") {
        if let Some(at_pos) = url.find('@') {
            let after_at = &url[at_pos + 1..];
            if let Some(slash_pos) = after_at.find('/') {
                return Some(after_at[..slash_pos].to_string());
            }
            // No slash, the rest is the host
            return Some(after_at.to_string());
        }
    }

    None
}
