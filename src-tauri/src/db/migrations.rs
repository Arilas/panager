use rusqlite::{Connection, Result};

/// Current schema version - increment this when adding new migrations
const CURRENT_VERSION: i32 = 2;

/// Run all pending migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Create migrations table if it doesn't exist
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )?;

    let current_version = get_current_version(conn)?;

    // Run migrations in order
    if current_version < 1 {
        migrate_v1(conn)?;
        set_version(conn, 1)?;
    }

    if current_version < 2 {
        migrate_v2(conn)?;
        set_version(conn, 2)?;
    }

    Ok(())
}

/// Get the current schema version
fn get_current_version(conn: &Connection) -> Result<i32> {
    let result: Result<i32, _> = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    );
    Ok(result.unwrap_or(0))
}

/// Set the schema version after a successful migration
fn set_version(conn: &Connection, version: i32) -> Result<()> {
    conn.execute(
        "INSERT INTO schema_migrations (version) VALUES (?1)",
        [version],
    )?;
    Ok(())
}

/// Migration v1: Add scope extensions and new tables for Max features
fn migrate_v1(conn: &Connection) -> Result<()> {
    // Add new columns to scopes table
    // SQLite requires separate ALTER TABLE statements for each column

    // Check if columns already exist (for safety)
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scopes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if !columns.contains(&"default_folder".to_string()) {
        conn.execute_batch("ALTER TABLE scopes ADD COLUMN default_folder TEXT;")?;
    }

    if !columns.contains(&"folder_scan_interval".to_string()) {
        conn.execute_batch(
            "ALTER TABLE scopes ADD COLUMN folder_scan_interval INTEGER DEFAULT 300000;",
        )?;
    }

    if !columns.contains(&"ssh_alias".to_string()) {
        conn.execute_batch("ALTER TABLE scopes ADD COLUMN ssh_alias TEXT;")?;
    }

    // Create new tables for Max features
    conn.execute_batch(
        r#"
        -- Ignored folder warnings (for repos outside scope's default folder)
        CREATE TABLE IF NOT EXISTS ignored_folder_warnings (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
            project_path TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(scope_id, project_path)
        );

        CREATE INDEX IF NOT EXISTS idx_ignored_warnings_scope
            ON ignored_folder_warnings(scope_id);

        -- Scope git config cache (identity from includeIf)
        CREATE TABLE IF NOT EXISTS scope_git_config (
            scope_id TEXT PRIMARY KEY REFERENCES scopes(id) ON DELETE CASCADE,
            user_name TEXT,
            user_email TEXT,
            gpg_sign INTEGER DEFAULT 0,
            config_file_path TEXT,
            last_checked_at TEXT
        );

        -- Project config issues (mismatches between expected and actual config)
        CREATE TABLE IF NOT EXISTS project_config_issues (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            issue_type TEXT NOT NULL,
            expected_value TEXT,
            actual_value TEXT,
            dismissed INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(project_id, issue_type)
        );

        CREATE INDEX IF NOT EXISTS idx_config_issues_project
            ON project_config_issues(project_id);
        "#,
    )?;

    // Add new settings for Max features
    conn.execute(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('max_git_integration', 'false'),
            ('max_ssh_integration', 'false')
        "#,
        [],
    )?;

    Ok(())
}

/// Migration v2: Add extended GPG signing options to scope_git_config
fn migrate_v2(conn: &Connection) -> Result<()> {
    // Check if columns already exist in scope_git_config
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scope_git_config)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if !columns.contains(&"gpg_signing_method".to_string()) {
        conn.execute_batch(
            "ALTER TABLE scope_git_config ADD COLUMN gpg_signing_method TEXT DEFAULT 'none';",
        )?;
    }

    if !columns.contains(&"signing_key".to_string()) {
        conn.execute_batch("ALTER TABLE scope_git_config ADD COLUMN signing_key TEXT;")?;
    }

    if !columns.contains(&"raw_gpg_config".to_string()) {
        conn.execute_batch("ALTER TABLE scope_git_config ADD COLUMN raw_gpg_config TEXT;")?;
    }

    Ok(())
}

/// Check if a specific migration has been applied
#[allow(dead_code)]
pub fn is_migration_applied(conn: &Connection, version: i32) -> Result<bool> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
        [version],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Get info about current database state (useful for debugging)
#[allow(dead_code)]
pub fn get_migration_info(conn: &Connection) -> Result<(i32, i32)> {
    let current = get_current_version(conn)?;
    Ok((current, CURRENT_VERSION))
}
