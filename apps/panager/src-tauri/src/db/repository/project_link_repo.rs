//! Repository for project link-related database operations

use chrono::Utc;
use rusqlite::Connection;

use crate::db::models::ProjectLink;
use crate::error::{PanagerError, Result};

/// Create a new project link
pub fn create_project_link(
    conn: &Connection,
    project_id: &str,
    link_type: &str,
    label: &str,
    url: &str,
) -> Result<ProjectLink> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // Get max sort order
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM project_links WHERE project_id = ?1",
            [project_id],
            |row| row.get(0),
        )
        .map_err(PanagerError::Database)?;

    conn.execute(
        r#"
        INSERT INTO project_links (id, project_id, link_type, label, url, sort_order, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        (
            &id,
            project_id,
            link_type,
            label,
            url,
            max_order + 1,
            now.to_rfc3339(),
        ),
    )
    .map_err(PanagerError::Database)?;

    Ok(ProjectLink {
        id,
        project_id: project_id.to_string(),
        link_type: link_type.to_string(),
        label: label.to_string(),
        url: url.to_string(),
        sort_order: max_order + 1,
        created_at: now,
    })
}

/// Delete a project link
pub fn delete_project_link(conn: &Connection, link_id: &str) -> Result<()> {
    conn.execute("DELETE FROM project_links WHERE id = ?1", [link_id])
        .map_err(PanagerError::Database)?;
    Ok(())
}

/// Get all links for a project
pub fn get_project_links(conn: &Connection, project_id: &str) -> Result<Vec<ProjectLink>> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, project_id, link_type, label, url, sort_order, created_at
            FROM project_links WHERE project_id = ?1 ORDER BY sort_order ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let links: Vec<ProjectLink> = stmt
        .query_map([project_id], |row| {
            Ok(ProjectLink {
                id: row.get(0)?,
                project_id: row.get(1)?,
                link_type: row.get(2)?,
                label: row.get(3)?,
                url: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row
                    .get::<_, String>(6)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()
        .map_err(PanagerError::Database)?;

    Ok(links)
}
