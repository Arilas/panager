//! Diagnostic rules system.
//!
//! This module defines the trait for diagnostic rules and provides
//! a registry of all available rules.

use crate::db::Database;
use crate::db::models::{ProjectWithStatus, Scope};
use super::models::{DiagnosticIssue, RuleGroup, RuleMetadata, Severity};

pub mod git;
pub mod project;
pub mod repo;
pub mod security;

/// Trait for diagnostic rules.
///
/// Each rule implements this trait to provide:
/// - Metadata about the rule
/// - Logic to check for issues
pub trait DiagnosticRule: Send + Sync {
    /// Get the rule's metadata.
    fn metadata(&self) -> RuleMetadata;

    /// Check for issues in a scope.
    ///
    /// For scope-level rules, `projects` may be empty.
    /// For project-level rules, this is called once per scope with all projects.
    fn check(
        &self,
        db: &Database,
        scope: &Scope,
        projects: &[ProjectWithStatus],
    ) -> Result<Vec<DiagnosticIssue>, String>;
}

/// Registry of all available diagnostic rules.
pub struct RuleRegistry {
    rules: Vec<Box<dyn DiagnosticRule>>,
}

impl Default for RuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleRegistry {
    /// Create a new registry with all available rules.
    pub fn new() -> Self {
        let rules: Vec<Box<dyn DiagnosticRule>> = vec![
            // Git rules
            Box::new(git::IdentityMismatchRule),
            Box::new(git::GpgMismatchRule),
            Box::new(git::SshRemoteMismatchRule),
            Box::new(git::MissingIdentityRule),
            Box::new(git::IncompleteIdentityForGpgRule),
            // Repo rules
            Box::new(repo::UnpushedCommitsRule),
            Box::new(repo::DetachedHeadRule),
            Box::new(repo::MergeConflictsRule),
            Box::new(repo::DivergedFromRemoteRule),
            // Project rules
            Box::new(project::OutsideFolderRule),
            Box::new(project::MissingGitignoreRule),
            Box::new(project::EmptyRepositoryRule),
            // Security rules
            Box::new(security::EnvFileTrackedRule),
            Box::new(security::InsecureRemoteRule),
            Box::new(security::NodeModulesCommittedRule),
        ];

        Self { rules }
    }

    /// Get all rules.
    pub fn all(&self) -> &[Box<dyn DiagnosticRule>] {
        &self.rules
    }

    /// Get rules by group.
    #[allow(dead_code)]
    pub fn by_group(&self, group: RuleGroup) -> Vec<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .filter(|r| r.metadata().group == group)
            .map(|r| r.as_ref())
            .collect()
    }

    /// Get a rule by ID.
    pub fn get(&self, rule_id: &str) -> Option<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .find(|r| r.metadata().id == rule_id)
            .map(|r| r.as_ref())
    }

    /// Get all rule metadata.
    pub fn metadata(&self) -> Vec<RuleMetadata> {
        self.rules.iter().map(|r| r.metadata()).collect()
    }

    /// Get rules that are enabled by default.
    #[allow(dead_code)]
    pub fn default_enabled(&self) -> Vec<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .filter(|r| r.metadata().default_enabled)
            .map(|r| r.as_ref())
            .collect()
    }

    /// Get rules that require a specific feature.
    pub fn by_feature(&self, feature: &str) -> Vec<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .filter(|r| r.metadata().required_feature.as_deref() == Some(feature))
            .map(|r| r.as_ref())
            .collect()
    }

    /// Get scope-level rules.
    #[allow(dead_code)]
    pub fn scope_level(&self) -> Vec<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .filter(|r| r.metadata().is_scope_level)
            .map(|r| r.as_ref())
            .collect()
    }

    /// Get project-level rules.
    pub fn project_level(&self) -> Vec<&dyn DiagnosticRule> {
        self.rules
            .iter()
            .filter(|r| !r.metadata().is_scope_level)
            .map(|r| r.as_ref())
            .collect()
    }
}

/// Helper to create rule metadata.
pub fn rule_metadata(
    id: &str,
    name: &str,
    description: &str,
    default_enabled: bool,
    default_severity: Severity,
    required_feature: Option<&str>,
    is_scope_level: bool,
) -> RuleMetadata {
    RuleMetadata {
        id: id.to_string(),
        group: RuleGroup::from_rule_id(id).unwrap_or(RuleGroup::Project),
        name: name.to_string(),
        description: description.to_string(),
        default_enabled,
        default_severity,
        required_feature: required_feature.map(String::from),
        is_scope_level,
    }
}
