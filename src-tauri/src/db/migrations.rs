use rusqlite::{Connection, Result};

/// Current schema version - increment this when adding new migrations
const CURRENT_VERSION: i32 = 5;

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

    if current_version < 3 {
        migrate_v3(conn)?;
        set_version(conn, 3)?;
    }

    if current_version < 4 {
        migrate_v4(conn)?;
        set_version(conn, 4)?;
    }

    if current_version < 5 {
        migrate_v5(conn)?;
        set_version(conn, 5)?;
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

/// Migration v3: Add temp project settings column to scopes (stored as JSON)
fn migrate_v3(conn: &Connection) -> Result<()> {
    // Check if column already exists in scopes
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scopes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if !columns.contains(&"temp_project_settings".to_string()) {
        conn.execute_batch(
            "ALTER TABLE scopes ADD COLUMN temp_project_settings TEXT;",
        )?;
    }

    Ok(())
}

/// Migration v4: Add diagnostics system tables
fn migrate_v4(conn: &Connection) -> Result<()> {
    // Create diagnostics table
    conn.execute_batch(
        r#"
        -- Main diagnostics table for storing all diagnostic issues
        CREATE TABLE IF NOT EXISTS diagnostics (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
            project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
            rule_id TEXT NOT NULL,
            severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            expected_value TEXT,
            actual_value TEXT,
            metadata TEXT,
            dismissed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(scope_id, project_id, rule_id)
        );

        CREATE INDEX IF NOT EXISTS idx_diagnostics_scope ON diagnostics(scope_id);
        CREATE INDEX IF NOT EXISTS idx_diagnostics_project ON diagnostics(project_id);
        CREATE INDEX IF NOT EXISTS idx_diagnostics_rule ON diagnostics(rule_id);
        CREATE INDEX IF NOT EXISTS idx_diagnostics_severity ON diagnostics(severity);

        -- Disabled diagnostic rules (global when scope_id is NULL)
        CREATE TABLE IF NOT EXISTS disabled_diagnostic_rules (
            id TEXT PRIMARY KEY,
            scope_id TEXT REFERENCES scopes(id) ON DELETE CASCADE,
            rule_id TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(scope_id, rule_id)
        );

        CREATE INDEX IF NOT EXISTS idx_disabled_rules_scope ON disabled_diagnostic_rules(scope_id);
        CREATE INDEX IF NOT EXISTS idx_disabled_rules_rule ON disabled_diagnostic_rules(rule_id);

        -- Track diagnostic scan state per scope
        CREATE TABLE IF NOT EXISTS diagnostics_scan_state (
            scope_id TEXT PRIMARY KEY REFERENCES scopes(id) ON DELETE CASCADE,
            last_scan_at TEXT,
            scan_duration_ms INTEGER,
            issues_found INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )?;

    // Add new settings for diagnostics
    conn.execute(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('diagnostics_enabled', 'true'),
            ('diagnostics_scan_interval', '300000')
        "#,
        [],
    )?;

    Ok(())
}

/// Migration v5: Add project settings columns and editor workspace support
fn migrate_v5(conn: &Connection) -> Result<()> {
    // Check if columns already exist in projects table
    let project_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(projects)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if !project_columns.contains(&"default_branch".to_string()) {
        conn.execute_batch("ALTER TABLE projects ADD COLUMN default_branch TEXT;")?;
    }

    if !project_columns.contains(&"workspace_file".to_string()) {
        conn.execute_batch("ALTER TABLE projects ADD COLUMN workspace_file TEXT;")?;
    }

    // Check if column already exists in editors table
    let editor_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(editors)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if !editor_columns.contains(&"supports_workspaces".to_string()) {
        conn.execute_batch(
            "ALTER TABLE editors ADD COLUMN supports_workspaces INTEGER NOT NULL DEFAULT 0;",
        )?;
    }

    // Mark VS Code and Cursor as workspace-capable
    conn.execute_batch(
        r#"
        UPDATE editors SET supports_workspaces = 1 
        WHERE command IN ('code', 'cursor') AND supports_workspaces = 0;
        "#,
    )?;

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
