//! IDE Database Migrations
//!
//! Migration system for per-project SQLite databases.
//!
//! BREAKING CHANGE: Version 3 introduces the unified entry architecture.
//! Old chat_sessions, chat_messages, and tool_calls tables are dropped.
//! All data is now stored in the new sessions and entries tables.

use rusqlite::{Connection, Result};

/// Current schema version - increment this when adding new migrations
const CURRENT_VERSION: i32 = 5;

/// Run all pending migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Create migrations table if it doesn't exist
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS ide_schema_migrations (
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

    // Migration v2: Add tool_calls table (legacy)
    if current_version < 2 {
        migrate_v2(conn)?;
        set_version(conn, 2)?;
    }

    // Migration v3: Unified entry architecture (BREAKING CHANGE)
    // Drops old tables and creates new sessions + entries tables
    if current_version < 3 {
        migrate_v3(conn)?;
        set_version(conn, 3)?;
    }

    // Migration v4: Add thought, plan, mode_change entry types and available_commands
    if current_version < 4 {
        migrate_v4(conn)?;
        set_version(conn, 4)?;
    }

    // Migration v5: Add tab_groups and tabs tables for unified tab management
    if current_version < 5 {
        migrate_v5(conn)?;
        set_version(conn, 5)?;
    }

    Ok(())
}

/// Get the current schema version
fn get_current_version(conn: &Connection) -> Result<i32> {
    let result: Result<i32, _> = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM ide_schema_migrations",
        [],
        |row| row.get(0),
    );
    Ok(result.unwrap_or(0))
}

/// Set the schema version after a successful migration
fn set_version(conn: &Connection, version: i32) -> Result<()> {
    conn.execute(
        "INSERT INTO ide_schema_migrations (version) VALUES (?1)",
        [version],
    )?;
    Ok(())
}

/// Migration v1: Create chat sessions and messages tables (legacy)
fn migrate_v1(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Chat sessions table (legacy - will be dropped in v3)
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'agent',
            status TEXT NOT NULL DEFAULT 'ready',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated
            ON chat_sessions(updated_at DESC);

        -- Chat messages table (legacy - will be dropped in v3)
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,  -- JSON array of ContentBlock
            timestamp INTEGER NOT NULL,
            tool_calls TEXT,        -- JSON array of ToolCall (optional)
            thoughts TEXT,          -- JSON array of strings (optional)
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_chat_messages_session
            ON chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp
            ON chat_messages(session_id, timestamp);
        "#,
    )?;

    Ok(())
}

/// Migration v2: Add tool_calls table (legacy - will be dropped in v3)
fn migrate_v2(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Tool calls table (legacy - will be dropped in v3)
        CREATE TABLE IF NOT EXISTS tool_calls (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            title TEXT,
            kind TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            raw_input TEXT,
            content TEXT,
            created_at INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_tool_calls_session
            ON tool_calls(session_id);
        CREATE INDEX IF NOT EXISTS idx_tool_calls_message
            ON tool_calls(message_id);
        "#,
    )?;

    Ok(())
}

/// Migration v3: Unified entry architecture (BREAKING CHANGE)
///
/// This migration:
/// 1. Drops all old tables (chat_sessions, chat_messages, tool_calls)
/// 2. Creates new sessions table (uses ACP session ID as primary key)
/// 3. Creates new entries table (unified storage for all chat items)
///
/// See plan file "Entry Processing Rules" for the entry architecture design.
fn migrate_v3(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Drop old tables (BREAKING CHANGE - data loss)
        DROP TABLE IF EXISTS tool_calls;
        DROP TABLE IF EXISTS chat_messages;
        DROP TABLE IF EXISTS chat_sessions;
        DROP INDEX IF EXISTS idx_chat_sessions_updated;
        DROP INDEX IF EXISTS idx_chat_messages_session;
        DROP INDEX IF EXISTS idx_chat_messages_timestamp;
        DROP INDEX IF EXISTS idx_tool_calls_session;
        DROP INDEX IF EXISTS idx_tool_calls_message;

        -- Sessions table: uses ACP session ID directly as primary key
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,              -- ACP session ID (used directly, no mapping)
            name TEXT NOT NULL,
            project_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
        CREATE INDEX idx_sessions_project ON sessions(project_path);

        -- Entries table: unified storage for all chat items
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Auto-increment for ordering
            session_id TEXT NOT NULL,              -- ACP session ID (FK to sessions)
            type TEXT NOT NULL CHECK(type IN ('meta', 'message', 'tool_call', 'permission_request')),

            -- Common fields
            created_at INTEGER NOT NULL,
            updated_at INTEGER,

            -- Message fields (type = 'message')
            role TEXT,                    -- 'user' | 'assistant'
            content TEXT,                 -- Plain text or markdown (chunks merged)

            -- Tool call fields (type = 'tool_call')
            tool_call_id TEXT,            -- ACP tool call ID
            tool_name TEXT,               -- Cleaned name: Read, Write, Bash, etc.
            tool_status TEXT,             -- pending, in_progress, completed, failed
            tool_input TEXT,              -- JSON of rawInput
            tool_output TEXT,             -- JSON of output (if small enough to store)
            tool_title TEXT,              -- Human-readable title
            tool_kind TEXT,               -- read, edit, execute, fetch, search, think

            -- Permission request fields (type = 'permission_request')
            request_id TEXT,              -- ACP request ID
            request_tool_name TEXT,       -- Tool requesting permission
            request_description TEXT,     -- Human-readable description
            request_options TEXT,         -- JSON array of options
            response_option TEXT,         -- Selected option ID (null if not answered)
            response_time INTEGER,        -- When answered (null if not answered)

            -- Meta fields (type = 'meta')
            available_modes TEXT,         -- JSON array of modes
            available_models TEXT,        -- JSON array of models
            current_mode_id TEXT,
            current_model_id TEXT,

            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_entries_session ON entries(session_id);
        CREATE INDEX idx_entries_type ON entries(session_id, type);
        CREATE INDEX idx_entries_tool_call_id ON entries(tool_call_id) WHERE tool_call_id IS NOT NULL;
        CREATE INDEX idx_entries_request_id ON entries(request_id) WHERE request_id IS NOT NULL;
        "#,
    )?;

    Ok(())
}

/// Migration v4: Add thought, plan, mode_change entry types and available_commands
///
/// This migration adds:
/// 1. New entry types: thought, plan, mode_change
/// 2. New columns: available_commands (meta), plan_entries (plan), previous_mode_id/new_mode_id (mode_change)
///
/// See ENTRY_PROCESSING_RULES.md for rule definitions.
fn migrate_v4(conn: &Connection) -> Result<()> {
    // SQLite doesn't support adding CHECK constraint modifications easily
    // We'll recreate the table with the updated CHECK constraint
    conn.execute_batch(
        r#"
        -- Add new columns for thought, plan, mode_change entries
        ALTER TABLE entries ADD COLUMN available_commands TEXT;
        ALTER TABLE entries ADD COLUMN plan_entries TEXT;
        ALTER TABLE entries ADD COLUMN previous_mode_id TEXT;
        ALTER TABLE entries ADD COLUMN new_mode_id TEXT;

        -- Update CHECK constraint by recreating the table
        -- First, create a new table with the updated schema
        CREATE TABLE entries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('meta', 'message', 'thought', 'tool_call', 'permission_request', 'plan', 'mode_change')),

            created_at INTEGER NOT NULL,
            updated_at INTEGER,

            role TEXT,
            content TEXT,

            tool_call_id TEXT,
            tool_name TEXT,
            tool_status TEXT,
            tool_input TEXT,
            tool_output TEXT,
            tool_title TEXT,
            tool_kind TEXT,

            request_id TEXT,
            request_tool_name TEXT,
            request_description TEXT,
            request_options TEXT,
            response_option TEXT,
            response_time INTEGER,

            available_modes TEXT,
            available_models TEXT,
            available_commands TEXT,
            current_mode_id TEXT,
            current_model_id TEXT,

            plan_entries TEXT,

            previous_mode_id TEXT,
            new_mode_id TEXT,

            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        -- Copy data from old table to new table
        INSERT INTO entries_new (
            id, session_id, type, created_at, updated_at,
            role, content,
            tool_call_id, tool_name, tool_status, tool_input, tool_output, tool_title, tool_kind,
            request_id, request_tool_name, request_description, request_options, response_option, response_time,
            available_modes, available_models, current_mode_id, current_model_id
        )
        SELECT
            id, session_id, type, created_at, updated_at,
            role, content,
            tool_call_id, tool_name, tool_status, tool_input, tool_output, tool_title, tool_kind,
            request_id, request_tool_name, request_description, request_options, response_option, response_time,
            available_modes, available_models, current_mode_id, current_model_id
        FROM entries;

        -- Drop old table and rename new one
        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;

        -- Recreate indexes
        CREATE INDEX idx_entries_session ON entries(session_id);
        CREATE INDEX idx_entries_type ON entries(session_id, type);
        CREATE INDEX idx_entries_tool_call_id ON entries(tool_call_id) WHERE tool_call_id IS NOT NULL;
        CREATE INDEX idx_entries_request_id ON entries(request_id) WHERE request_id IS NOT NULL;
        "#,
    )?;

    Ok(())
}

/// Migration v5: Add tab_groups and tabs tables for unified tab management
///
/// This migration introduces:
/// 1. tab_groups table for split view support
/// 2. tabs table with URL-based identification and session data
///
/// See plan file for the tab system architecture design.
fn migrate_v5(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Tab groups for split view support
        CREATE TABLE tab_groups (
            id TEXT PRIMARY KEY,
            position INTEGER NOT NULL,         -- Order of groups (left to right)
            is_active INTEGER DEFAULT 0,       -- Currently focused group (0 or 1)
            created_at INTEGER NOT NULL
        );

        CREATE INDEX idx_tab_groups_position ON tab_groups(position);

        -- Tabs belong to groups
        CREATE TABLE tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL REFERENCES tab_groups(id) ON DELETE CASCADE,
            url TEXT NOT NULL,                  -- Tab URL (file://, diff://, chat://, etc.)
            type TEXT NOT NULL,                 -- Resolver ID (file, diff, chat, markdown)
            display_name TEXT NOT NULL,         -- Human-readable name for tab bar
            position INTEGER NOT NULL,          -- Order within group
            is_pinned INTEGER DEFAULT 0,        -- Pinned tabs stay at start (0 or 1)
            is_active INTEGER DEFAULT 0,        -- Active tab within group (0 or 1)
            is_preview INTEGER DEFAULT 0,       -- Preview tabs are replaced on new open (0 or 1)

            -- Session data (persisted for all tabs)
            cursor_line INTEGER,
            cursor_column INTEGER,
            scroll_top REAL,
            scroll_left REAL,
            selections TEXT,                    -- JSON array
            folded_regions TEXT,                -- JSON array

            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,

            -- Same URL can exist in different groups, but not same group
            UNIQUE(group_id, url)
        );

        CREATE INDEX idx_tabs_group ON tabs(group_id);
        CREATE INDEX idx_tabs_url ON tabs(url);
        CREATE INDEX idx_tabs_position ON tabs(group_id, position);
        "#,
    )?;

    Ok(())
}

/// Check if a specific migration has been applied
#[allow(dead_code)]
pub fn is_migration_applied(conn: &Connection, version: i32) -> Result<bool> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM ide_schema_migrations WHERE version = ?1",
        [version],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Get info about current database state
#[allow(dead_code)]
pub fn get_migration_info(conn: &Connection) -> Result<(i32, i32)> {
    let current = get_current_version(conn)?;
    Ok((current, CURRENT_VERSION))
}
