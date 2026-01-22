//! Repository for editor-related database operations

use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};

use crate::db::models::Editor;
use crate::error::{PanagerError, Result};

/// Fetch all available editors
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// Vector of available editors
pub fn fetch_available_editors(conn: &Connection) -> Result<Vec<Editor>> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, command, icon, is_auto_detected, is_available, supports_workspaces, created_at
            FROM editors
            WHERE is_available = 1
            ORDER BY is_auto_detected DESC, name ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let editors: Vec<Editor> = stmt
        .query_map([], |row| {
            Ok(Editor {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                icon: row.get(3)?,
                is_auto_detected: row.get(4)?,
                is_available: row.get(5)?,
                supports_workspaces: row.get::<_, i32>(6)? != 0,
                created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(editors)
}

/// Fetch all editors (including unavailable)
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// Vector of all editors
pub fn fetch_all_editors(conn: &Connection) -> Result<Vec<Editor>> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, command, icon, is_auto_detected, is_available, supports_workspaces, created_at
            FROM editors
            ORDER BY is_auto_detected DESC, name ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let editors: Vec<Editor> = stmt
        .query_map([], |row| {
            Ok(Editor {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                icon: row.get(3)?,
                is_auto_detected: row.get(4)?,
                is_available: row.get(5)?,
                supports_workspaces: row.get::<_, i32>(6)? != 0,
                created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(editors)
}

/// Find an editor by ID
///
/// # Arguments
/// * `conn` - Database connection
/// * `editor_id` - The editor ID
///
/// # Returns
/// The editor if found
pub fn find_editor_by_id(conn: &Connection, editor_id: &str) -> Result<Option<Editor>> {
    let sql = r#"
        SELECT id, name, command, icon, is_auto_detected, is_available, supports_workspaces, created_at
        FROM editors
        WHERE id = ?1
    "#;

    conn.query_row(sql, [editor_id], |row| {
        Ok(Editor {
            id: row.get(0)?,
            name: row.get(1)?,
            command: row.get(2)?,
            icon: row.get(3)?,
            is_auto_detected: row.get(4)?,
            is_available: row.get(5)?,
            supports_workspaces: row.get::<_, i32>(6)? != 0,
            created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Find an editor by command
///
/// # Arguments
/// * `conn` - Database connection
/// * `command` - The editor command
///
/// # Returns
/// The editor if found
pub fn find_editor_by_command(conn: &Connection, command: &str) -> Result<Option<Editor>> {
    let sql = r#"
        SELECT id, name, command, icon, is_auto_detected, is_available, supports_workspaces, created_at
        FROM editors
        WHERE command = ?1
    "#;

    conn.query_row(sql, [command], |row| {
        Ok(Editor {
            id: row.get(0)?,
            name: row.get(1)?,
            command: row.get(2)?,
            icon: row.get(3)?,
            is_auto_detected: row.get(4)?,
            is_available: row.get(5)?,
            supports_workspaces: row.get::<_, i32>(6)? != 0,
            created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Update editor availability status
///
/// # Arguments
/// * `conn` - Database connection
/// * `editor_id` - The editor ID
/// * `is_available` - Whether the editor is available
pub fn update_editor_availability(
    conn: &Connection,
    editor_id: &str,
    is_available: bool,
) -> Result<()> {
    conn.execute(
        "UPDATE editors SET is_available = ?1 WHERE id = ?2",
        rusqlite::params![is_available, editor_id],
    )
    .map_err(PanagerError::Database)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE editors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                icon TEXT,
                is_auto_detected INTEGER DEFAULT 0,
                is_available INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_fetch_available_editors_empty() {
        let conn = setup_test_db();
        let result = fetch_available_editors(&conn).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_find_editor_by_id_not_found() {
        let conn = setup_test_db();
        let result = find_editor_by_id(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }
}
