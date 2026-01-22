//! Application event types for the event bus system.
//!
//! Events follow a namespaced pattern and are emitted by commands/services
//! to notify other parts of the system about state changes.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Application events that flow through the event bus.
///
/// Events are categorized by their source domain:
/// - Project events: Changes to project entities
/// - Scope events: Changes to scope configuration
/// - Settings events: Application settings changes
/// - Scanner events: Background folder scanner results
/// - Diagnostics events: Diagnostic scan results
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "payload")]
pub enum AppEvent {
    // =========================================================================
    // Project Events
    // =========================================================================
    /// A new project was added to a scope
    ProjectAdded {
        project_id: String,
        scope_id: String,
    },

    /// A project was removed from a scope
    ProjectRemoved {
        project_id: String,
        scope_id: String,
    },

    /// A project was moved from one scope to another
    ProjectMoved {
        project_id: String,
        old_scope_id: String,
        new_scope_id: String,
    },

    /// A project's filesystem path changed (e.g., moved to scope folder)
    ProjectPathChanged {
        project_id: String,
        scope_id: String,
        old_path: String,
        new_path: String,
    },

    /// A project's git status changed (commits, branches, etc.)
    ProjectGitStatusChanged {
        project_id: String,
        scope_id: String,
    },

    // =========================================================================
    // Scope Events
    // =========================================================================
    /// A new scope was created
    ScopeCreated {
        scope_id: String,
    },

    /// A scope was deleted
    ScopeDeleted {
        scope_id: String,
    },

    /// A scope's default folder setting changed
    ScopeDefaultFolderChanged {
        scope_id: String,
        old_folder: Option<String>,
        new_folder: Option<String>,
    },

    /// A scope's git identity configuration changed
    ScopeGitIdentityChanged {
        scope_id: String,
    },

    /// A scope's SSH alias configuration changed
    ScopeSshAliasChanged {
        scope_id: String,
    },

    // =========================================================================
    // Settings Events
    // =========================================================================
    /// A setting value changed
    SettingChanged {
        key: String,
        old_value: String,
        new_value: String,
    },

    /// A Max feature was toggled on/off
    MaxFeatureToggled {
        feature: String,
        enabled: bool,
    },

    // =========================================================================
    // Folder Scanner Events
    // =========================================================================
    /// Background folder scan completed for a scope
    FolderScanCompleted {
        scope_id: String,
        projects_found: Vec<String>,
    },

    // =========================================================================
    // Diagnostics Events
    // =========================================================================
    /// Diagnostics were updated for a scope
    DiagnosticsUpdated {
        scope_id: String,
    },

    /// Diagnostics were cleared (optionally for a specific rule type)
    DiagnosticsCleared {
        scope_id: String,
        rule_id: Option<String>,
    },
}

impl AppEvent {
    /// Get the scope ID associated with this event, if any.
    pub fn scope_id(&self) -> Option<&str> {
        match self {
            AppEvent::ProjectAdded { scope_id, .. }
            | AppEvent::ProjectRemoved { scope_id, .. }
            | AppEvent::ProjectPathChanged { scope_id, .. }
            | AppEvent::ProjectGitStatusChanged { scope_id, .. }
            | AppEvent::ScopeCreated { scope_id }
            | AppEvent::ScopeDeleted { scope_id }
            | AppEvent::ScopeDefaultFolderChanged { scope_id, .. }
            | AppEvent::ScopeGitIdentityChanged { scope_id }
            | AppEvent::ScopeSshAliasChanged { scope_id }
            | AppEvent::FolderScanCompleted { scope_id, .. }
            | AppEvent::DiagnosticsUpdated { scope_id }
            | AppEvent::DiagnosticsCleared { scope_id, .. } => Some(scope_id),

            AppEvent::ProjectMoved { new_scope_id, .. } => Some(new_scope_id),

            AppEvent::SettingChanged { .. } | AppEvent::MaxFeatureToggled { .. } => None,
        }
    }

    /// Get the project ID associated with this event, if any.
    pub fn project_id(&self) -> Option<&str> {
        match self {
            AppEvent::ProjectAdded { project_id, .. }
            | AppEvent::ProjectRemoved { project_id, .. }
            | AppEvent::ProjectMoved { project_id, .. }
            | AppEvent::ProjectPathChanged { project_id, .. }
            | AppEvent::ProjectGitStatusChanged { project_id, .. } => Some(project_id),

            _ => None,
        }
    }

    /// Get a short description of the event for logging.
    pub fn description(&self) -> String {
        match self {
            AppEvent::ProjectAdded { project_id, scope_id } => {
                format!("Project {} added to scope {}", project_id, scope_id)
            }
            AppEvent::ProjectRemoved { project_id, scope_id } => {
                format!("Project {} removed from scope {}", project_id, scope_id)
            }
            AppEvent::ProjectMoved {
                project_id,
                old_scope_id,
                new_scope_id,
            } => {
                format!(
                    "Project {} moved from scope {} to {}",
                    project_id, old_scope_id, new_scope_id
                )
            }
            AppEvent::ProjectPathChanged {
                project_id,
                old_path,
                new_path,
                ..
            } => {
                format!(
                    "Project {} path changed from {} to {}",
                    project_id, old_path, new_path
                )
            }
            AppEvent::ProjectGitStatusChanged { project_id, .. } => {
                format!("Project {} git status changed", project_id)
            }
            AppEvent::ScopeCreated { scope_id } => {
                format!("Scope {} created", scope_id)
            }
            AppEvent::ScopeDeleted { scope_id } => {
                format!("Scope {} deleted", scope_id)
            }
            AppEvent::ScopeDefaultFolderChanged { scope_id, .. } => {
                format!("Scope {} default folder changed", scope_id)
            }
            AppEvent::ScopeGitIdentityChanged { scope_id } => {
                format!("Scope {} git identity changed", scope_id)
            }
            AppEvent::ScopeSshAliasChanged { scope_id } => {
                format!("Scope {} SSH alias changed", scope_id)
            }
            AppEvent::SettingChanged { key, .. } => {
                format!("Setting '{}' changed", key)
            }
            AppEvent::MaxFeatureToggled { feature, enabled } => {
                format!(
                    "Max feature '{}' {}",
                    feature,
                    if *enabled { "enabled" } else { "disabled" }
                )
            }
            AppEvent::FolderScanCompleted {
                scope_id,
                projects_found,
            } => {
                format!(
                    "Folder scan completed for scope {}, found {} projects",
                    scope_id,
                    projects_found.len()
                )
            }
            AppEvent::DiagnosticsUpdated { scope_id } => {
                format!("Diagnostics updated for scope {}", scope_id)
            }
            AppEvent::DiagnosticsCleared { scope_id, rule_id } => match rule_id {
                Some(rule) => format!("Diagnostics cleared for rule {} in scope {}", rule, scope_id),
                None => format!("All diagnostics cleared for scope {}", scope_id),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_scope_id() {
        let event = AppEvent::ProjectAdded {
            project_id: "proj1".to_string(),
            scope_id: "scope1".to_string(),
        };
        assert_eq!(event.scope_id(), Some("scope1"));

        let event = AppEvent::SettingChanged {
            key: "foo".to_string(),
            old_value: "bar".to_string(),
            new_value: "baz".to_string(),
        };
        assert_eq!(event.scope_id(), None);
    }

    #[test]
    fn test_event_project_id() {
        let event = AppEvent::ProjectMoved {
            project_id: "proj1".to_string(),
            old_scope_id: "scope1".to_string(),
            new_scope_id: "scope2".to_string(),
        };
        assert_eq!(event.project_id(), Some("proj1"));

        let event = AppEvent::ScopeCreated {
            scope_id: "scope1".to_string(),
        };
        assert_eq!(event.project_id(), None);
    }
}
