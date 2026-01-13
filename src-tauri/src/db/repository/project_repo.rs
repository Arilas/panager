//! Repository for project-related database operations

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::db::models::{GitStatusCache, Project, ProjectWithStatus};
use crate::error::{PanagerError, Result};

/// Fetch projects with their git status and tags
///
/// This is the shared implementation used by both get_projects and get_all_projects.
///
/// # Arguments
/// * `conn` - Database connection
/// * `scope_id` - Optional scope ID to filter by (None = all projects)
///
/// # Returns
/// Vector of projects with their status information
pub fn fetch_projects_with_status(
    conn: &Connection,
    scope_id: Option<&str>,
) -> Result<Vec<ProjectWithStatus>> {
    let sql = if scope_id.is_some() {
        r#"
        SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
               p.default_branch, p.workspace_file, p.is_temp, p.is_pinned, p.group_id,
               p.notes, p.description, p.last_opened_at, 
               p.created_at, p.updated_at,
               g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
               g.last_checked_at, g.remote_url
        FROM projects p
        LEFT JOIN git_status_cache g ON p.id = g.project_id
        WHERE p.scope_id = ?1
        ORDER BY p.is_pinned DESC, p.is_temp DESC, p.last_opened_at DESC NULLS LAST, p.name ASC
        "#
    } else {
        r#"
        SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
               p.default_branch, p.workspace_file, p.is_temp, p.is_pinned, p.group_id,
               p.notes, p.description, p.last_opened_at, 
               p.created_at, p.updated_at,
               g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
               g.last_checked_at, g.remote_url
        FROM projects p
        LEFT JOIN git_status_cache g ON p.id = g.project_id
        ORDER BY p.is_pinned DESC, p.is_temp DESC, p.last_opened_at DESC NULLS LAST, p.name ASC
        "#
    };

    let mut stmt = conn.prepare(sql).map_err(PanagerError::Database)?;

    let row_mapper = |row: &rusqlite::Row| -> rusqlite::Result<(Project, Option<GitStatusCache>)> {
        let project = Project {
            id: row.get(0)?,
            scope_id: row.get(1)?,
            name: row.get(2)?,
            path: row.get(3)?,
            preferred_editor_id: row.get(4)?,
            default_branch: row.get(5)?,
            workspace_file: row.get(6)?,
            is_temp: row.get(7)?,
            is_pinned: row.get::<_, i32>(8).unwrap_or(0) != 0,
            group_id: row.get(9).ok().flatten(),
            notes: row.get(10).ok().flatten(),
            description: row.get(11).ok().flatten(),
            last_opened_at: row.get::<_, Option<String>>(12)?.map(|s| {
                s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
            }),
            created_at: row.get::<_, String>(13)?.parse().unwrap_or_else(|_| Utc::now()),
            updated_at: row.get::<_, String>(14)?.parse().unwrap_or_else(|_| Utc::now()),
        };

        let git_status = row.get::<_, Option<String>>(15)?.map(|branch| {
            GitStatusCache {
                project_id: project.id.clone(),
                branch: Some(branch),
                ahead: row.get(16).unwrap_or(0),
                behind: row.get(17).unwrap_or(0),
                has_uncommitted: row.get(18).unwrap_or(false),
                has_untracked: row.get(19).unwrap_or(false),
                last_checked_at: row.get::<_, Option<String>>(20).ok().flatten().map(|s| {
                    s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
                }),
                remote_url: row.get(21).ok().flatten(),
            }
        });

        Ok((project, git_status))
    };

    let projects: Vec<(Project, Option<GitStatusCache>)> = if let Some(scope_id) = scope_id {
        stmt.query_map([scope_id], row_mapper)
            .map_err(PanagerError::Database)?
            .filter_map(|r: rusqlite::Result<(Project, Option<GitStatusCache>)>| r.ok())
            .collect()
    } else {
        stmt.query_map([], row_mapper)
            .map_err(PanagerError::Database)?
            .filter_map(|r: rusqlite::Result<(Project, Option<GitStatusCache>)>| r.ok())
            .collect()
    };

    // Fetch tags, links, and group for each project
    let mut result = Vec::with_capacity(projects.len());
    for (project, git_status) in projects {
        let tags = fetch_project_tags(conn, &project.id)?;
        // Note: Links and group will be loaded separately when needed
        result.push(ProjectWithStatus {
            project,
            tags,
            git_status,
            links: Vec::new(),
            group: None,
            statistics: None,
        });
    }

    Ok(result)
}

/// Fetch tags for a specific project
///
/// # Arguments
/// * `conn` - Database connection
/// * `project_id` - The project ID
///
/// # Returns
/// Vector of tag strings
pub fn fetch_project_tags(conn: &Connection, project_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn
        .prepare("SELECT tag FROM project_tags WHERE project_id = ?1")
        .map_err(PanagerError::Database)?;

    let tags: Vec<String> = stmt
        .query_map([project_id], |row| row.get(0))
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
}

/// Find a project by ID
///
/// # Arguments
/// * `conn` - Database connection
/// * `project_id` - The project ID
///
/// # Returns
/// The project if found
pub fn find_project_by_id(conn: &Connection, project_id: &str) -> Result<Option<Project>> {
    let sql = r#"
        SELECT id, scope_id, name, path, preferred_editor_id,
               default_branch, workspace_file, is_temp, is_pinned, group_id,
               notes, description, last_opened_at, created_at, updated_at
        FROM projects
        WHERE id = ?1
    "#;

    conn.query_row(sql, [project_id], |row| {
        Ok(Project {
            id: row.get(0)?,
            scope_id: row.get(1)?,
            name: row.get(2)?,
            path: row.get(3)?,
            preferred_editor_id: row.get(4)?,
            default_branch: row.get(5)?,
            workspace_file: row.get(6)?,
            is_temp: row.get(7)?,
            is_pinned: row.get::<_, i32>(8).unwrap_or(0) != 0,
            group_id: row.get(9).ok().flatten(),
            notes: row.get(10).ok().flatten(),
            description: row.get(11).ok().flatten(),
            last_opened_at: row.get::<_, Option<String>>(12)?.map(|s| {
                s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
            }),
            created_at: row.get::<_, String>(13)?.parse().unwrap_or_else(|_| Utc::now()),
            updated_at: row.get::<_, String>(14)?.parse().unwrap_or_else(|_| Utc::now()),
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Find a project by path
///
/// # Arguments
/// * `conn` - Database connection
/// * `path` - The project path
///
/// # Returns
/// The project if found
pub fn find_project_by_path(conn: &Connection, path: &str) -> Result<Option<Project>> {
    let sql = r#"
        SELECT id, scope_id, name, path, preferred_editor_id,
               default_branch, workspace_file, is_temp, is_pinned, group_id,
               notes, description, last_opened_at, created_at, updated_at
        FROM projects
        WHERE path = ?1
    "#;

    conn.query_row(sql, [path], |row| {
        Ok(Project {
            id: row.get(0)?,
            scope_id: row.get(1)?,
            name: row.get(2)?,
            path: row.get(3)?,
            preferred_editor_id: row.get(4)?,
            default_branch: row.get(5)?,
            workspace_file: row.get(6)?,
            is_temp: row.get(7)?,
            is_pinned: row.get::<_, i32>(8).unwrap_or(0) != 0,
            group_id: row.get(9).ok().flatten(),
            notes: row.get(10).ok().flatten(),
            description: row.get(11).ok().flatten(),
            last_opened_at: row.get::<_, Option<String>>(12)?.map(|s| {
                s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
            }),
            created_at: row.get::<_, String>(13)?.parse().unwrap_or_else(|_| Utc::now()),
            updated_at: row.get::<_, String>(14)?.parse().unwrap_or_else(|_| Utc::now()),
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Delete all data associated with a project
///
/// This performs a cascading delete of:
/// - Project tags
/// - Git status cache
/// - The project itself
///
/// # Arguments
/// * `conn` - Database connection
/// * `project_id` - The project ID
pub fn delete_project_cascade(conn: &Connection, project_id: &str) -> Result<()> {
    // Delete tags
    conn.execute(
        "DELETE FROM project_tags WHERE project_id = ?1",
        [project_id],
    )
    .map_err(PanagerError::Database)?;

    // Delete git status cache
    conn.execute(
        "DELETE FROM git_status_cache WHERE project_id = ?1",
        [project_id],
    )
    .map_err(PanagerError::Database)?;

    // Delete project
    conn.execute("DELETE FROM projects WHERE id = ?1", [project_id])
        .map_err(PanagerError::Database)?;

    Ok(())
}

/// Get temporary projects older than a specified number of days
///
/// # Arguments
/// * `conn` - Database connection
/// * `days` - Number of days threshold
///
/// # Returns
/// Vector of projects that are candidates for cleanup
pub fn get_temp_projects_for_cleanup(conn: &Connection, days: i64) -> Result<Vec<Project>> {
    let sql = r#"
        SELECT id, scope_id, name, path, preferred_editor_id,
               default_branch, workspace_file, is_temp, is_pinned, group_id,
               notes, description, last_opened_at, created_at, updated_at
        FROM projects
        WHERE is_temp = 1
        AND datetime(created_at) < datetime('now', ?1)
    "#;

    let days_param = format!("-{} days", days);
    let mut stmt = conn.prepare(sql).map_err(PanagerError::Database)?;

    let projects: Vec<Project> = stmt
        .query_map([days_param], |row| {
            Ok(Project {
                id: row.get(0)?,
                scope_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                preferred_editor_id: row.get(4)?,
                default_branch: row.get(5)?,
                workspace_file: row.get(6)?,
                is_temp: row.get(7)?,
                is_pinned: row.get::<_, i32>(8).unwrap_or(0) != 0,
                group_id: row.get(9).ok().flatten(),
                notes: row.get(10).ok().flatten(),
                description: row.get(11).ok().flatten(),
                last_opened_at: row.get::<_, Option<String>>(12)?.map(|s| {
                    s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
                }),
                created_at: row.get::<_, String>(13)?.parse().unwrap_or_else(|_| Utc::now()),
                updated_at: row.get::<_, String>(14)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                scope_id TEXT NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                preferred_editor_id TEXT,
                is_temp INTEGER DEFAULT 0,
                last_opened_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE project_tags (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                tag TEXT NOT NULL
            );

            CREATE TABLE git_status_cache (
                project_id TEXT PRIMARY KEY,
                branch TEXT,
                ahead INTEGER DEFAULT 0,
                behind INTEGER DEFAULT 0,
                has_uncommitted INTEGER DEFAULT 0,
                has_untracked INTEGER DEFAULT 0,
                last_checked_at TEXT,
                remote_url TEXT
            );
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_fetch_projects_with_status_empty() {
        let conn = setup_test_db();
        let result = fetch_projects_with_status(&conn, None).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_fetch_project_tags_empty() {
        let conn = setup_test_db();
        let tags = fetch_project_tags(&conn, "nonexistent").unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn test_find_project_by_id_not_found() {
        let conn = setup_test_db();
        let result = find_project_by_id(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }
}
