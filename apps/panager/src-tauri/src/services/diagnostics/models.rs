//! Diagnostic models and types.
//!
//! This module defines the core types used throughout the diagnostics system,
//! including severity levels, rule groups, and diagnostic issues.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Severity level for diagnostic issues.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// Critical issues that prevent functionality (e.g., missing required config)
    Error,
    /// Issues that should be addressed but don't break functionality
    Warning,
    /// Informational notices and suggestions
    Info,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Error => "error",
            Severity::Warning => "warning",
            Severity::Info => "info",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "error" => Some(Severity::Error),
            "warning" => Some(Severity::Warning),
            "info" => Some(Severity::Info),
            _ => None,
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Rule groups for organizing diagnostic rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum RuleGroup {
    /// Git configuration and identity rules (git/*)
    Git,
    /// Repository health and state rules (repo/*)
    Repo,
    /// Project structure and organization rules (project/*)
    Project,
    /// Security-related rules (security/*)
    Security,
}

impl RuleGroup {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuleGroup::Git => "git",
            RuleGroup::Repo => "repo",
            RuleGroup::Project => "project",
            RuleGroup::Security => "security",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            RuleGroup::Git => "Git Configuration",
            RuleGroup::Repo => "Repository Health",
            RuleGroup::Project => "Project Structure",
            RuleGroup::Security => "Security",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            RuleGroup::Git => "Identity, signing, and remote configuration",
            RuleGroup::Repo => "Branch state, conflicts, and sync status",
            RuleGroup::Project => "File structure and organization",
            RuleGroup::Security => "Secrets, credentials, and access",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            RuleGroup::Git => "GitBranch",
            RuleGroup::Repo => "Activity",
            RuleGroup::Project => "Folder",
            RuleGroup::Security => "Shield",
        }
    }

    pub fn from_rule_id(rule_id: &str) -> Option<Self> {
        let group = rule_id.split('/').next()?;
        match group {
            "git" => Some(RuleGroup::Git),
            "repo" => Some(RuleGroup::Repo),
            "project" => Some(RuleGroup::Project),
            "security" => Some(RuleGroup::Security),
            _ => None,
        }
    }
}

/// Metadata about a diagnostic rule.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RuleMetadata {
    /// Unique identifier (e.g., "git/identity-mismatch")
    pub id: String,
    /// Rule group
    pub group: RuleGroup,
    /// Human-readable name (e.g., "Identity Mismatch")
    pub name: String,
    /// Description of what this rule checks
    pub description: String,
    /// Whether this rule is enabled by default
    pub default_enabled: bool,
    /// Default severity level
    pub default_severity: Severity,
    /// Max feature this rule depends on (None = always active)
    pub required_feature: Option<String>,
    /// Whether this rule applies at scope level (vs project level)
    pub is_scope_level: bool,
}

/// A diagnostic issue found during scanning.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticIssue {
    /// Unique identifier for this issue instance
    pub id: String,
    /// Scope this issue belongs to
    pub scope_id: String,
    /// Project this issue relates to (None for scope-level issues)
    pub project_id: Option<String>,
    /// Rule that generated this issue (e.g., "git/identity-mismatch")
    pub rule_id: String,
    /// Severity level
    pub severity: Severity,
    /// Short title describing the issue
    pub title: String,
    /// Detailed description
    pub description: String,
    /// Expected value (for mismatch issues)
    pub expected_value: Option<String>,
    /// Actual value found (for mismatch issues)
    pub actual_value: Option<String>,
    /// Additional metadata as JSON
    pub metadata: Option<serde_json::Value>,
    /// Whether this issue has been dismissed by the user
    pub dismissed: bool,
    /// When this issue was first detected
    pub created_at: DateTime<Utc>,
    /// When this issue was last updated
    pub updated_at: DateTime<Utc>,
}

impl DiagnosticIssue {
    /// Create a new diagnostic issue with generated ID and timestamps.
    pub fn new(
        scope_id: String,
        project_id: Option<String>,
        rule_id: String,
        severity: Severity,
        title: String,
        description: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            scope_id,
            project_id,
            rule_id,
            severity,
            title,
            description,
            expected_value: None,
            actual_value: None,
            metadata: None,
            dismissed: false,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set expected and actual values for mismatch issues.
    pub fn with_values(mut self, expected: Option<String>, actual: Option<String>) -> Self {
        self.expected_value = expected;
        self.actual_value = actual;
        self
    }

    /// Set additional metadata.
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    /// Get the rule group for this issue.
    pub fn group(&self) -> Option<RuleGroup> {
        RuleGroup::from_rule_id(&self.rule_id)
    }
}

/// Summary of diagnostics for a scope.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScopeDiagnosticsSummary {
    pub scope_id: String,
    pub error_count: i32,
    pub warning_count: i32,
    pub info_count: i32,
    pub total_count: i32,
    pub last_scan_at: Option<DateTime<Utc>>,
}

/// A disabled diagnostic rule.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DisabledRule {
    pub id: String,
    /// Scope this rule is disabled for (None = global)
    pub scope_id: Option<String>,
    pub rule_id: String,
    pub created_at: DateTime<Utc>,
}

/// Request to fix a diagnostic issue.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticFix {
    pub issue_id: String,
    pub rule_id: String,
    /// Type of fix to apply (rule-specific)
    pub fix_type: String,
    /// Additional parameters for the fix
    pub params: Option<serde_json::Value>,
}

/// Scan state for a scope.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanState {
    pub scope_id: String,
    pub last_scan_at: Option<DateTime<Utc>>,
    pub scan_duration_ms: Option<i64>,
    pub issues_found: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_serialization() {
        assert_eq!(Severity::Error.as_str(), "error");
        assert_eq!(Severity::parse("warning"), Some(Severity::Warning));
    }

    #[test]
    fn test_rule_group_from_rule_id() {
        assert_eq!(
            RuleGroup::from_rule_id("git/identity-mismatch"),
            Some(RuleGroup::Git)
        );
        assert_eq!(
            RuleGroup::from_rule_id("security/secrets-in-files"),
            Some(RuleGroup::Security)
        );
        assert_eq!(RuleGroup::from_rule_id("invalid"), None);
    }

    #[test]
    fn test_diagnostic_issue_creation() {
        let issue = DiagnosticIssue::new(
            "scope1".to_string(),
            Some("project1".to_string()),
            "git/identity-mismatch".to_string(),
            Severity::Warning,
            "Git identity mismatch".to_string(),
            "The git user.name differs from the expected scope configuration.".to_string(),
        )
        .with_values(Some("Expected Name".to_string()), Some("Actual Name".to_string()));

        assert_eq!(issue.scope_id, "scope1");
        assert_eq!(issue.project_id, Some("project1".to_string()));
        assert_eq!(issue.rule_id, "git/identity-mismatch");
        assert_eq!(issue.severity, Severity::Warning);
        assert_eq!(issue.expected_value, Some("Expected Name".to_string()));
        assert_eq!(issue.actual_value, Some("Actual Name".to_string()));
        assert_eq!(issue.group(), Some(RuleGroup::Git));
    }
}
