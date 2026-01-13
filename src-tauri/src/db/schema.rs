use rusqlite::{Connection, Result};

pub fn init_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Scopes/Profiles
        CREATE TABLE IF NOT EXISTS scopes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT,
            icon TEXT,
            default_editor_id TEXT,
            settings TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Scope Links
        CREATE TABLE IF NOT EXISTS scope_links (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
            link_type TEXT NOT NULL,
            label TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            preferred_editor_id TEXT,
            is_temp INTEGER NOT NULL DEFAULT 0,
            last_opened_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Project Tags
        CREATE TABLE IF NOT EXISTS project_tags (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            tag TEXT NOT NULL,
            UNIQUE(project_id, tag)
        );

        -- Editors
        CREATE TABLE IF NOT EXISTS editors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            icon TEXT,
            is_auto_detected INTEGER NOT NULL DEFAULT 0,
            is_available INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- App Settings
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Git Status Cache
        CREATE TABLE IF NOT EXISTS git_status_cache (
            project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            branch TEXT,
            ahead INTEGER NOT NULL DEFAULT 0,
            behind INTEGER NOT NULL DEFAULT 0,
            has_uncommitted INTEGER NOT NULL DEFAULT 0,
            has_untracked INTEGER NOT NULL DEFAULT 0,
            last_checked_at TEXT,
            remote_url TEXT
        );

        -- Project Links
        CREATE TABLE IF NOT EXISTS project_links (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            link_type TEXT NOT NULL,
            label TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Project Groups
        CREATE TABLE IF NOT EXISTS project_groups (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Project Commands
        CREATE TABLE IF NOT EXISTS project_commands (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT,
            working_directory TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_projects_scope ON projects(scope_id);
        CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(project_id);
        CREATE INDEX IF NOT EXISTS idx_scope_links_scope ON scope_links(scope_id);
        CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_groups_scope ON project_groups(scope_id);
        CREATE INDEX IF NOT EXISTS idx_project_commands_project ON project_commands(project_id);
        -- Note: idx_projects_group and idx_projects_pinned are created in migration v6
        -- after the columns are added
        "#,
    )?;

    // Insert default settings if not exists
    conn.execute(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('git_refresh_interval', '900000'),
            ('temp_project_cleanup_days', '7'),
            ('temp_project_path', ''),
            ('global_hotkey', '"CmdOrCtrl+Shift+O"'),
            ('theme', '"system"')
        "#,
        [],
    )?;

    Ok(())
}
