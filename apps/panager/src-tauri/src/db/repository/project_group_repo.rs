//! Repository for project group-related database operations

use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};

use crate::db::models::ProjectGroup;
use crate::error::{PanagerError, Result};

/// Create a new project group
pub fn create_project_group(
    conn: &Connection,
    scope_id: &str,
    name: &str,
    color: Option<&str>,
) -> Result<ProjectGroup> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // Get max sort order
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM project_groups WHERE scope_id = ?1",
            [scope_id],
            |row| row.get(0),
        )
        .map_err(PanagerError::Database)?;

    conn.execute(
        r#"
        INSERT INTO project_groups (id, scope_id, name, color, sort_order, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        (
            &id,
            scope_id,
            name,
            color,
            max_order + 1,
            now.to_rfc3339(),
        ),
    )
    .map_err(PanagerError::Database)?;

    Ok(ProjectGroup {
        id,
        scope_id: scope_id.to_string(),
        name: name.to_string(),
        color: color.map(|s| s.to_string()),
        sort_order: max_order + 1,
        created_at: now,
    })
}

/// Update a project group
pub fn update_project_group(
    conn: &Connection,
    group_id: &str,
    name: Option<&str>,
    color: Option<&str>,
) -> Result<()> {
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(n) = name {
        updates.push("name = ?1".to_string());
        params.push(Box::new(n));
    }

    if let Some(c) = color {
        updates.push(format!("color = ?{}", params.len() + 1));
        params.push(Box::new(c));
    }

    if updates.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE project_groups SET {} WHERE id = ?{}",
        updates.join(", "),
        params.len() + 1
    );
    params.push(Box::new(group_id));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(PanagerError::Database)?;

    Ok(())
}

/// Delete a project group
pub fn delete_project_group(conn: &Connection, group_id: &str) -> Result<()> {
    // First, remove all projects from this group
    conn.execute(
        "UPDATE projects SET group_id = NULL WHERE group_id = ?1",
        [group_id],
    )
    .map_err(PanagerError::Database)?;

    // Then delete the group
    conn.execute("DELETE FROM project_groups WHERE id = ?1", [group_id])
        .map_err(PanagerError::Database)?;

    Ok(())
}

/// Get all groups for a scope
pub fn get_project_groups(conn: &Connection, scope_id: &str) -> Result<Vec<ProjectGroup>> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, scope_id, name, color, sort_order, created_at
            FROM project_groups WHERE scope_id = ?1 ORDER BY sort_order ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let groups: Vec<ProjectGroup> = stmt
        .query_map([scope_id], |row| {
            Ok(ProjectGroup {
                id: row.get(0)?,
                scope_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3).ok().flatten(),
                sort_order: row.get(4)?,
                created_at: row
                    .get::<_, String>(5)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()
        .map_err(PanagerError::Database)?;

    Ok(groups)
}

/// Get a project group by ID
pub fn get_project_group_by_id(conn: &Connection, group_id: &str) -> Result<Option<ProjectGroup>> {
    let result = conn
        .query_row(
            r#"
            SELECT id, scope_id, name, color, sort_order, created_at
            FROM project_groups WHERE id = ?1
            "#,
            [group_id],
            |row| {
                Ok(ProjectGroup {
                    id: row.get(0)?,
                    scope_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3).ok().flatten(),
                    sort_order: row.get(4)?,
                    created_at: row
                        .get::<_, String>(5)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                })
            },
        )
        .optional()
        .map_err(PanagerError::Database)?;

    Ok(result)
}

/// Assign a project to a group
pub fn assign_project_to_group(
    conn: &Connection,
    project_id: &str,
    group_id: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE projects SET group_id = ?1 WHERE id = ?2",
        (group_id, project_id),
    )
    .map_err(PanagerError::Database)?;
    Ok(())
}
