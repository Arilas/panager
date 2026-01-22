//! SQL query builders for scope-related operations
//!
//! This module provides helper functions for building SQL queries.
//! Future improvement: integrate with sea-query for type-safe query building.

use chrono::Utc;

use crate::db::models::ScopeUpdates;

/// Build an UPDATE query for a scope with only the provided fields
///
/// This generates a parameterized query that only updates the fields that are Some.
///
/// # Arguments
/// * `id` - The scope ID to update
/// * `updates` - The updates to apply
///
/// # Returns
/// A tuple of (SQL string, parameter values as strings for binding)
pub fn build_update_scope_query(id: &str, updates: &ScopeUpdates) -> (String, Vec<String>) {
    let now = Utc::now().to_rfc3339();

    let mut sets: Vec<String> = vec!["updated_at = ?".to_string()];
    let mut params: Vec<String> = vec![now];

    if let Some(name) = &updates.name {
        sets.push("name = ?".to_string());
        params.push(name.clone());
    }

    if let Some(color) = &updates.color {
        sets.push("color = ?".to_string());
        params.push(color.clone());
    }

    if let Some(icon) = &updates.icon {
        sets.push("icon = ?".to_string());
        params.push(icon.clone());
    }

    if let Some(editor_id) = &updates.default_editor_id {
        sets.push("default_editor_id = ?".to_string());
        params.push(editor_id.clone());
    }

    if let Some(folder) = &updates.default_folder {
        sets.push("default_folder = ?".to_string());
        params.push(folder.clone());
    }

    if let Some(interval) = updates.folder_scan_interval {
        sets.push("folder_scan_interval = ?".to_string());
        params.push(interval.to_string());
    }

    if let Some(alias) = &updates.ssh_alias {
        sets.push("ssh_alias = ?".to_string());
        params.push(alias.clone());
    }

    if let Some(settings) = &updates.temp_project_settings {
        let json = serde_json::to_string(settings).unwrap_or_default();
        sets.push("temp_project_settings = ?".to_string());
        params.push(json);
    }

    // Add the id at the end for the WHERE clause
    params.push(id.to_string());

    let sql = format!("UPDATE scopes SET {} WHERE id = ?", sets.join(", "));
    (sql, params)
}

/// Build queries to reorder scopes
///
/// # Arguments
/// * `scope_ids` - The scope IDs in the desired order
///
/// # Returns
/// A vector of (scope_id, new_sort_order) tuples
pub fn build_reorder_scopes_params(scope_ids: &[String]) -> Vec<(String, i32)> {
    scope_ids
        .iter()
        .enumerate()
        .map(|(index, id)| (id.clone(), index as i32))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::TempProjectSettings;

    #[test]
    fn test_build_update_scope_query_name_only() {
        let updates = ScopeUpdates {
            name: Some("New Name".to_string()),
            ..Default::default()
        };

        let (sql, params) = build_update_scope_query("scope-123", &updates);

        assert!(sql.contains("UPDATE scopes SET"));
        assert!(sql.contains("name = ?"));
        assert!(sql.contains("updated_at = ?"));
        assert!(sql.contains("WHERE id = ?"));
        assert!(params.len() == 3); // updated_at, name, id
    }

    #[test]
    fn test_build_update_scope_query_multiple_fields() {
        let updates = ScopeUpdates {
            name: Some("New Name".to_string()),
            color: Some("#FF0000".to_string()),
            default_folder: Some("/path/to/folder".to_string()),
            ..Default::default()
        };

        let (sql, params) = build_update_scope_query("scope-123", &updates);

        assert!(sql.contains("name = ?"));
        assert!(sql.contains("color = ?"));
        assert!(sql.contains("default_folder = ?"));
        assert!(params.len() == 5); // updated_at, name, color, default_folder, id
    }

    #[test]
    fn test_build_update_scope_query_with_temp_settings() {
        let updates = ScopeUpdates {
            temp_project_settings: Some(TempProjectSettings {
                cleanup_days: 7,
                setup_git_identity: true,
                preferred_package_manager: "npm".to_string(),
            }),
            ..Default::default()
        };

        let (sql, params) = build_update_scope_query("scope-123", &updates);

        assert!(sql.contains("temp_project_settings = ?"));
        assert!(params.len() == 3); // updated_at, temp_project_settings, id
    }

    #[test]
    fn test_build_reorder_scopes_params() {
        let scope_ids = vec![
            "scope-1".to_string(),
            "scope-2".to_string(),
            "scope-3".to_string(),
        ];

        let params = build_reorder_scopes_params(&scope_ids);

        assert_eq!(params.len(), 3);
        assert_eq!(params[0], ("scope-1".to_string(), 0));
        assert_eq!(params[1], ("scope-2".to_string(), 1));
        assert_eq!(params[2], ("scope-3".to_string(), 2));
    }
}
