//! Repository for scope-related database operations

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::db::models::{Scope, ScopeGitConfig, ScopeLink, ScopeWithLinks, TempProjectSettings};
use crate::error::{PanagerError, Result};

/// Fetch all scopes with their associated links
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// Vector of scopes with their links
pub fn fetch_all_scopes_with_links(conn: &Connection) -> Result<Vec<ScopeWithLinks>> {
    let mut scope_stmt = conn
        .prepare(
            r#"
            SELECT id, name, color, icon, default_editor_id, settings, sort_order,
                   created_at, updated_at, default_folder, folder_scan_interval,
                   ssh_alias, temp_project_settings
            FROM scopes
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let scopes: Vec<Scope> = scope_stmt
        .query_map([], |row| {
            let temp_settings: Option<TempProjectSettings> = row
                .get::<_, Option<String>>(12)?
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Scope {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                default_editor_id: row.get(4)?,
                settings: row.get::<_, Option<String>>(5)?.and_then(|s| serde_json::from_str(&s).ok()),
                sort_order: row.get(6)?,
                created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
                updated_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
                default_folder: row.get(9)?,
                folder_scan_interval: row.get(10)?,
                ssh_alias: row.get(11)?,
                temp_project_settings: temp_settings,
            })
        })
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    let mut link_stmt = conn
        .prepare(
            r#"
            SELECT id, scope_id, link_type, label, url, sort_order, created_at
            FROM scope_links
            WHERE scope_id = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let mut result = Vec::with_capacity(scopes.len());
    for scope in scopes {
        let links: Vec<ScopeLink> = link_stmt
            .query_map([&scope.id], |row| {
                Ok(ScopeLink {
                    id: row.get(0)?,
                    scope_id: row.get(1)?,
                    link_type: row.get(2)?,
                    label: row.get(3)?,
                    url: row.get(4)?,
                    sort_order: row.get(5)?,
                    created_at: row.get::<_, String>(6)?.parse().unwrap_or_else(|_| Utc::now()),
                })
            })
            .map_err(PanagerError::Database)?
            .filter_map(|r| r.ok())
            .collect();

        result.push(ScopeWithLinks { scope, links });
    }

    Ok(result)
}

/// Find a scope by ID
///
/// # Arguments
/// * `conn` - Database connection
/// * `scope_id` - The scope ID
///
/// # Returns
/// The scope if found
pub fn find_scope_by_id(conn: &Connection, scope_id: &str) -> Result<Option<Scope>> {
    let sql = r#"
        SELECT id, name, color, icon, default_editor_id, settings, sort_order,
               created_at, updated_at, default_folder, folder_scan_interval,
               ssh_alias, temp_project_settings
        FROM scopes
        WHERE id = ?1
    "#;

    conn.query_row(sql, [scope_id], |row| {
        let temp_settings: Option<TempProjectSettings> = row
            .get::<_, Option<String>>(12)?
            .and_then(|s| serde_json::from_str(&s).ok());

        Ok(Scope {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            default_editor_id: row.get(4)?,
            settings: row.get::<_, Option<String>>(5)?.and_then(|s| serde_json::from_str(&s).ok()),
            sort_order: row.get(6)?,
            created_at: row.get::<_, String>(7)?.parse().unwrap_or_else(|_| Utc::now()),
            updated_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
            default_folder: row.get(9)?,
            folder_scan_interval: row.get(10)?,
            ssh_alias: row.get(11)?,
            temp_project_settings: temp_settings,
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Get the default folder for a scope
///
/// # Arguments
/// * `conn` - Database connection
/// * `scope_id` - The scope ID
///
/// # Returns
/// The default folder path if set
pub fn get_scope_default_folder(conn: &Connection, scope_id: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT default_folder FROM scopes WHERE id = ?1",
        [scope_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(PanagerError::Database)
    .map(|opt| opt.flatten())
}

/// Get the git config for a scope
///
/// # Arguments
/// * `conn` - Database connection
/// * `scope_id` - The scope ID
///
/// # Returns
/// The git config if found
pub fn get_scope_git_config(conn: &Connection, scope_id: &str) -> Result<Option<ScopeGitConfig>> {
    let sql = r#"
        SELECT scope_id, user_name, user_email, gpg_sign,
               gpg_signing_method, signing_key, raw_gpg_config,
               config_file_path, last_checked_at
        FROM scope_git_config
        WHERE scope_id = ?1
    "#;

    conn.query_row(sql, [scope_id], |row| {
        Ok(ScopeGitConfig {
            scope_id: row.get(0)?,
            user_name: row.get(1)?,
            user_email: row.get(2)?,
            gpg_sign: row.get(3)?,
            gpg_signing_method: row.get(4)?,
            signing_key: row.get(5)?,
            raw_gpg_config: row.get(6)?,
            config_file_path: row.get(7)?,
            last_checked_at: row
                .get::<_, Option<String>>(8)?
                .map(|s| s.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())),
        })
    })
    .optional()
    .map_err(PanagerError::Database)
}

/// Delete all data associated with a scope
///
/// This performs a cascading delete of:
/// - Scope links
/// - Projects and their associated data
/// - Git config
/// - Ignored folder warnings
/// - The scope itself
///
/// # Arguments
/// * `conn` - Database connection
/// * `scope_id` - The scope ID
pub fn delete_scope_cascade(conn: &Connection, scope_id: &str) -> Result<()> {
    // Delete scope links
    conn.execute(
        "DELETE FROM scope_links WHERE scope_id = ?1",
        [scope_id],
    )
    .map_err(PanagerError::Database)?;

    // Get all project IDs for this scope
    let mut stmt = conn
        .prepare("SELECT id FROM projects WHERE scope_id = ?1")
        .map_err(PanagerError::Database)?;

    let project_ids: Vec<String> = stmt
        .query_map([scope_id], |row| row.get(0))
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .collect();

    // Delete project-related data
    for project_id in &project_ids {
        conn.execute(
            "DELETE FROM project_tags WHERE project_id = ?1",
            [project_id],
        )
        .map_err(PanagerError::Database)?;

        conn.execute(
            "DELETE FROM git_status_cache WHERE project_id = ?1",
            [project_id],
        )
        .map_err(PanagerError::Database)?;
    }

    // Delete projects
    conn.execute("DELETE FROM projects WHERE scope_id = ?1", [scope_id])
        .map_err(PanagerError::Database)?;

    // Delete scope git config
    conn.execute(
        "DELETE FROM scope_git_config WHERE scope_id = ?1",
        [scope_id],
    )
    .map_err(PanagerError::Database)?;

    // Delete ignored folder warnings
    conn.execute(
        "DELETE FROM ignored_folder_warnings WHERE scope_id = ?1",
        [scope_id],
    )
    .map_err(PanagerError::Database)?;

    // Delete the scope itself
    conn.execute("DELETE FROM scopes WHERE id = ?1", [scope_id])
        .map_err(PanagerError::Database)?;

    Ok(())
}

/// Get the maximum sort order for scopes
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// The maximum sort order, or 0 if no scopes exist
pub fn get_max_scope_sort_order(conn: &Connection) -> Result<i32> {
    conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM scopes",
        [],
        |row| row.get(0),
    )
    .map_err(PanagerError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE scopes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT,
                icon TEXT,
                default_editor_id TEXT,
                settings TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                default_folder TEXT,
                folder_scan_interval INTEGER,
                ssh_alias TEXT,
                temp_project_settings TEXT
            );

            CREATE TABLE scope_links (
                id TEXT PRIMARY KEY,
                scope_id TEXT NOT NULL,
                link_type TEXT NOT NULL,
                label TEXT NOT NULL,
                url TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE scope_git_config (
                scope_id TEXT PRIMARY KEY,
                user_name TEXT,
                user_email TEXT,
                gpg_sign INTEGER DEFAULT 0,
                gpg_signing_method TEXT,
                signing_key TEXT,
                raw_gpg_config TEXT,
                config_file_path TEXT,
                last_checked_at TEXT
            );

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

            CREATE TABLE ignored_folder_warnings (
                id TEXT PRIMARY KEY,
                scope_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_fetch_all_scopes_with_links_empty() {
        let conn = setup_test_db();
        let result = fetch_all_scopes_with_links(&conn).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_find_scope_by_id_not_found() {
        let conn = setup_test_db();
        let result = find_scope_by_id(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_max_scope_sort_order_empty() {
        let conn = setup_test_db();
        let result = get_max_scope_sort_order(&conn).unwrap();
        assert_eq!(result, -1);
    }
}
