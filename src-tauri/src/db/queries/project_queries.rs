//! SQL query builders for project-related operations
//!
//! This module provides helper functions for building SQL queries.

use chrono::Utc;

use crate::db::models::ProjectUpdates;

/// Build an UPDATE query for a project with only the provided fields
///
/// # Arguments
/// * `id` - The project ID to update
/// * `updates` - The updates to apply
///
/// # Returns
/// A tuple of (SQL string, parameter values)
pub fn build_update_project_query(id: &str, updates: &ProjectUpdates) -> (String, Vec<String>) {
    let now = Utc::now().to_rfc3339();

    let mut sets: Vec<String> = vec!["updated_at = ?".to_string()];
    let mut params: Vec<String> = vec![now];

    if let Some(name) = &updates.name {
        sets.push("name = ?".to_string());
        params.push(name.clone());
    }

    if let Some(editor_id) = &updates.preferred_editor_id {
        sets.push("preferred_editor_id = ?".to_string());
        params.push(editor_id.clone());
    }

    if let Some(scope_id) = &updates.scope_id {
        sets.push("scope_id = ?".to_string());
        params.push(scope_id.clone());
    }

    // Add the id at the end for the WHERE clause
    params.push(id.to_string());

    let sql = format!("UPDATE projects SET {} WHERE id = ?", sets.join(", "));
    (sql, params)
}

/// Build a query to get projects with optional scope filter
///
/// # Arguments
/// * `scope_id` - Optional scope ID to filter by
///
/// # Returns
/// SQL string for the query
pub fn build_get_projects_query(scope_id: Option<&str>) -> String {
    let base_sql = r#"
        SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
               p.is_temp, p.last_opened_at, p.created_at, p.updated_at,
               g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
               g.last_checked_at, g.remote_url
        FROM projects p
        LEFT JOIN git_status_cache g ON p.id = g.project_id
    "#;

    let order_clause = "ORDER BY p.is_temp DESC, p.last_opened_at DESC NULLS LAST, p.name ASC";

    if scope_id.is_some() {
        format!("{} WHERE p.scope_id = ?1 {}", base_sql.trim(), order_clause)
    } else {
        format!("{} {}", base_sql.trim(), order_clause)
    }
}

/// Build a query to update the last opened timestamp
///
/// # Arguments
/// * `project_id` - The project ID
///
/// # Returns
/// SQL string for the query (uses ?1 for the timestamp parameter)
pub fn build_update_last_opened_sql() -> &'static str {
    "UPDATE projects SET last_opened_at = ?1, updated_at = ?1 WHERE id = ?2"
}

/// Build a query to move a project to a different scope
///
/// # Returns
/// SQL string for the query
pub fn build_move_project_sql() -> &'static str {
    "UPDATE projects SET scope_id = ?1, updated_at = ?2 WHERE id = ?3"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_update_project_query_name_only() {
        let updates = ProjectUpdates {
            name: Some("New Project Name".to_string()),
            ..Default::default()
        };

        let (sql, params) = build_update_project_query("proj-123", &updates);

        assert!(sql.contains("UPDATE projects SET"));
        assert!(sql.contains("name = ?"));
        assert!(params.len() == 3); // updated_at, name, id
    }

    #[test]
    fn test_build_update_project_query_multiple_fields() {
        let updates = ProjectUpdates {
            name: Some("New Name".to_string()),
            preferred_editor_id: Some("vscode".to_string()),
            ..Default::default()
        };

        let (sql, params) = build_update_project_query("proj-123", &updates);

        assert!(sql.contains("name = ?"));
        assert!(sql.contains("preferred_editor_id = ?"));
        assert!(params.len() == 4); // updated_at, name, preferred_editor_id, id
    }

    #[test]
    fn test_build_get_projects_query_with_scope() {
        let sql = build_get_projects_query(Some("scope-123"));

        assert!(sql.contains("WHERE p.scope_id = ?1"));
        assert!(sql.contains("LEFT JOIN git_status_cache"));
    }

    #[test]
    fn test_build_get_projects_query_all() {
        let sql = build_get_projects_query(None);

        assert!(!sql.contains("WHERE"));
        assert!(sql.contains("LEFT JOIN git_status_cache"));
    }
}
