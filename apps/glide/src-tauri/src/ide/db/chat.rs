//! Chat Database Operations
//!
//! Provides CRUD operations for chat sessions and entries.
//! Uses a unified "entry" architecture where all items (messages, tool calls,
//! permission requests, meta) are stored in a single entries table with a type field.
//!
//! See: src/ide/docs/ENTRY_PROCESSING_RULES.md

use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::migrations;

/// Database file name within .panager directory
const DB_FILENAME: &str = "ide.db";

/// Directory name for panager data
const PANAGER_DIR: &str = ".panager";

/// Entry type discriminator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Meta,
    Message,
    Thought,
    ToolCall,
    PermissionRequest,
    Plan,
    ModeChange,
}

impl EntryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntryType::Meta => "meta",
            EntryType::Message => "message",
            EntryType::Thought => "thought",
            EntryType::ToolCall => "tool_call",
            EntryType::PermissionRequest => "permission_request",
            EntryType::Plan => "plan",
            EntryType::ModeChange => "mode_change",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "meta" => Some(EntryType::Meta),
            "message" => Some(EntryType::Message),
            "thought" => Some(EntryType::Thought),
            "tool_call" => Some(EntryType::ToolCall),
            "permission_request" => Some(EntryType::PermissionRequest),
            "plan" => Some(EntryType::Plan),
            "mode_change" => Some(EntryType::ModeChange),
            _ => None,
        }
    }
}

/// Chat session stored in database
/// Uses ACP session ID directly as primary key (no internal ID mapping)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbSession {
    pub id: String,              // ACP session ID (primary key)
    pub name: String,
    pub project_path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Session info for listing (without entries)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbSessionInfo {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub entry_count: i64,
}

/// Unified entry stored in database
/// All chat items (messages, tool calls, permission requests, meta) use this structure
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbEntry {
    pub id: Option<i64>,         // Auto-increment (for ordering)
    pub session_id: String,      // ACP session ID (FK)
    pub entry_type: String,      // meta, message, tool_call, permission_request
    pub created_at: i64,
    pub updated_at: Option<i64>,

    // Message fields (type = 'message')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,                    // 'user' | 'assistant'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,                 // Plain text or markdown (chunks merged)

    // Tool call fields (type = 'tool_call')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,            // ACP tool call ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,               // Read, Write, Bash, etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_status: Option<String>,             // pending, in_progress, completed, failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<String>,              // JSON of rawInput
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<String>,             // JSON of output (if small enough)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_title: Option<String>,              // Human-readable title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_kind: Option<String>,               // read, edit, execute, fetch, search, think

    // Permission request fields (type = 'permission_request')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,              // ACP request ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_tool_name: Option<String>,       // Tool requesting permission
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_description: Option<String>,     // Human-readable description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_options: Option<String>,         // JSON array of options
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_option: Option<String>,         // Selected option ID (null if not answered)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i64>,              // When answered (null if not answered)

    // Meta fields (type = 'meta')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_modes: Option<String>,         // JSON array of modes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_models: Option<String>,        // JSON array of models
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_commands: Option<String>,      // JSON array of commands
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_mode_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_model_id: Option<String>,

    // Plan fields (type = 'plan')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_entries: Option<String>,            // JSON array of plan entries

    // Mode change fields (type = 'mode_change')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_mode_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_mode_id: Option<String>,
}

impl DbEntry {
    /// Create a new message entry
    pub fn new_message(session_id: &str, role: &str, content: &str) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::Message.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            role: Some(role.to_string()),
            content: Some(content.to_string()),
            // All other fields None
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            plan_entries: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new tool call entry
    pub fn new_tool_call(
        session_id: &str,
        tool_call_id: &str,
        tool_name: &str,
        status: &str,
        kind: Option<&str>,
        title: Option<&str>,
        raw_input: Option<&str>,
    ) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::ToolCall.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            tool_call_id: Some(tool_call_id.to_string()),
            tool_name: Some(tool_name.to_string()),
            tool_status: Some(status.to_string()),
            tool_kind: kind.map(|s| s.to_string()),
            tool_title: title.map(|s| s.to_string()),
            tool_input: raw_input.map(|s| s.to_string()),
            tool_output: None,
            // All other fields None
            role: None,
            content: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            plan_entries: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new permission request entry
    pub fn new_permission_request(
        session_id: &str,
        request_id: &str,
        tool_name: &str,
        description: &str,
        options_json: &str,
    ) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::PermissionRequest.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            request_id: Some(request_id.to_string()),
            request_tool_name: Some(tool_name.to_string()),
            request_description: Some(description.to_string()),
            request_options: Some(options_json.to_string()),
            response_option: None,
            response_time: None,
            // All other fields None
            role: None,
            content: None,
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            plan_entries: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new thought entry
    pub fn new_thought(session_id: &str, content: &str) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::Thought.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            role: None, // Thoughts don't have a role (always from assistant)
            content: Some(content.to_string()),
            // All other fields None
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            plan_entries: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new meta entry
    pub fn new_meta(
        session_id: &str,
        available_modes: &str,
        available_models: Option<&str>,
        available_commands: Option<&str>,
        current_mode_id: &str,
        current_model_id: Option<&str>,
    ) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::Meta.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            available_modes: Some(available_modes.to_string()),
            available_models: available_models.map(|s| s.to_string()),
            available_commands: available_commands.map(|s| s.to_string()),
            current_mode_id: Some(current_mode_id.to_string()),
            current_model_id: current_model_id.map(|s| s.to_string()),
            // All other fields None
            role: None,
            content: None,
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            plan_entries: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new plan entry (RULE 10)
    pub fn new_plan(session_id: &str, entries_json: &str) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::Plan.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            plan_entries: Some(entries_json.to_string()),
            // All other fields None
            role: None,
            content: None,
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            previous_mode_id: None,
            new_mode_id: None,
        }
    }

    /// Create a new mode change entry (RULE 11)
    pub fn new_mode_change(session_id: &str, previous_mode_id: &str, new_mode_id: &str) -> Self {
        Self {
            id: None,
            session_id: session_id.to_string(),
            entry_type: EntryType::ModeChange.as_str().to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: None,
            previous_mode_id: Some(previous_mode_id.to_string()),
            new_mode_id: Some(new_mode_id.to_string()),
            // All other fields None
            role: None,
            content: None,
            tool_call_id: None,
            tool_name: None,
            tool_status: None,
            tool_input: None,
            tool_output: None,
            tool_title: None,
            tool_kind: None,
            request_id: None,
            request_tool_name: None,
            request_description: None,
            request_options: None,
            response_option: None,
            response_time: None,
            available_modes: None,
            available_models: None,
            available_commands: None,
            current_mode_id: None,
            current_model_id: None,
            plan_entries: None,
        }
    }
}

/// Session with entries (for loading full session)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbSessionWithEntries {
    pub session: DbSession,
    pub entries: Vec<DbEntry>,
}

/// Chat database manager
pub struct ChatDb {
    conn: Mutex<Connection>,
    project_path: PathBuf,
}

impl ChatDb {
    /// Open or create the chat database for a project
    pub fn open(project_path: &Path) -> Result<Self> {
        let panager_dir = project_path.join(PANAGER_DIR);
        std::fs::create_dir_all(&panager_dir).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to create .panager dir: {}", e).into())
        })?;

        let db_path = panager_dir.join(DB_FILENAME);
        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // Run migrations
        migrations::run_migrations(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
            project_path: project_path.to_path_buf(),
        })
    }

    /// Get the project path this database is associated with
    pub fn project_path(&self) -> &Path {
        &self.project_path
    }

    // =========================================================================
    // Session Operations
    // =========================================================================

    /// Create a new chat session
    pub fn create_session(&self, session: &DbSession) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute(
            r#"
            INSERT INTO sessions (id, name, project_path, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                session.id,
                session.name,
                session.project_path,
                session.created_at,
                session.updated_at,
            ],
        )?;
        Ok(())
    }

    /// Get a session by ID
    pub fn get_session(&self, session_id: &str) -> Result<Option<DbSession>> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.query_row(
            r#"
            SELECT id, name, project_path, created_at, updated_at
            FROM sessions
            WHERE id = ?1
            "#,
            [session_id],
            |row| {
                Ok(DbSession {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    project_path: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .optional()
    }

    /// List all sessions with entry counts (ordered by most recent)
    pub fn list_sessions(&self) -> Result<Vec<DbSessionInfo>> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn.prepare(
            r#"
            SELECT
                s.id, s.name, s.project_path, s.created_at, s.updated_at,
                (SELECT COUNT(*) FROM entries WHERE session_id = s.id) as entry_count
            FROM sessions s
            ORDER BY s.updated_at DESC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(DbSessionInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                project_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                entry_count: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    /// Update session name
    pub fn update_session_name(&self, session_id: &str, name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE sessions
            SET name = ?1, updated_at = ?2
            WHERE id = ?3
            "#,
            params![name, now, session_id],
        )?;
        Ok(())
    }

    /// Update session timestamp (call after adding entries)
    pub fn touch_session(&self, session_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE sessions
            SET updated_at = ?1
            WHERE id = ?2
            "#,
            params![now, session_id],
        )?;
        Ok(())
    }

    /// Delete a session and all its entries
    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute("DELETE FROM sessions WHERE id = ?1", [session_id])?;
        Ok(())
    }

    // =========================================================================
    // Entry Operations
    // =========================================================================

    /// Add an entry to a session, returns the auto-generated entry ID
    pub fn add_entry(&self, entry: &DbEntry) -> Result<i64> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());

        conn.execute(
            r#"
            INSERT INTO entries (
                session_id, type, created_at, updated_at,
                role, content,
                tool_call_id, tool_name, tool_status, tool_input, tool_output, tool_title, tool_kind,
                request_id, request_tool_name, request_description, request_options, response_option, response_time,
                available_modes, available_models, available_commands, current_mode_id, current_model_id,
                plan_entries, previous_mode_id, new_mode_id
            )
            VALUES (
                ?1, ?2, ?3, ?4,
                ?5, ?6,
                ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                ?14, ?15, ?16, ?17, ?18, ?19,
                ?20, ?21, ?22, ?23, ?24,
                ?25, ?26, ?27
            )
            "#,
            params![
                entry.session_id,
                entry.entry_type,
                entry.created_at,
                entry.updated_at,
                entry.role,
                entry.content,
                entry.tool_call_id,
                entry.tool_name,
                entry.tool_status,
                entry.tool_input,
                entry.tool_output,
                entry.tool_title,
                entry.tool_kind,
                entry.request_id,
                entry.request_tool_name,
                entry.request_description,
                entry.request_options,
                entry.response_option,
                entry.response_time,
                entry.available_modes,
                entry.available_models,
                entry.available_commands,
                entry.current_mode_id,
                entry.current_model_id,
                entry.plan_entries,
                entry.previous_mode_id,
                entry.new_mode_id,
            ],
        )?;

        let entry_id = conn.last_insert_rowid();

        // Update session timestamp
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, entry.session_id],
        )?;

        Ok(entry_id)
    }

    /// Get all entries for a session (ordered by ID for chronological order)
    pub fn get_session_entries(&self, session_id: &str) -> Result<Vec<DbEntry>> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id, session_id, type, created_at, updated_at,
                role, content,
                tool_call_id, tool_name, tool_status, tool_input, tool_output, tool_title, tool_kind,
                request_id, request_tool_name, request_description, request_options, response_option, response_time,
                available_modes, available_models, available_commands, current_mode_id, current_model_id,
                plan_entries, previous_mode_id, new_mode_id
            FROM entries
            WHERE session_id = ?1
            ORDER BY id ASC
            "#,
        )?;

        let rows = stmt.query_map([session_id], |row| {
            Ok(DbEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                entry_type: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                role: row.get(5)?,
                content: row.get(6)?,
                tool_call_id: row.get(7)?,
                tool_name: row.get(8)?,
                tool_status: row.get(9)?,
                tool_input: row.get(10)?,
                tool_output: row.get(11)?,
                tool_title: row.get(12)?,
                tool_kind: row.get(13)?,
                request_id: row.get(14)?,
                request_tool_name: row.get(15)?,
                request_description: row.get(16)?,
                request_options: row.get(17)?,
                response_option: row.get(18)?,
                response_time: row.get(19)?,
                available_modes: row.get(20)?,
                available_models: row.get(21)?,
                available_commands: row.get(22)?,
                current_mode_id: row.get(23)?,
                current_model_id: row.get(24)?,
                plan_entries: row.get(25)?,
                previous_mode_id: row.get(26)?,
                new_mode_id: row.get(27)?,
            })
        })?;

        rows.collect()
    }

    // =========================================================================
    // Message Chunk Handling (RULE 1, RULE 2)
    // See "Entry Processing Rules" in plan document
    // =========================================================================

    /// Get the last entry for a session (for message chunk merging)
    pub fn get_last_entry(&self, session_id: &str) -> Result<Option<DbEntry>> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.query_row(
            r#"
            SELECT
                id, session_id, type, created_at, updated_at,
                role, content,
                tool_call_id, tool_name, tool_status, tool_input, tool_output, tool_title, tool_kind,
                request_id, request_tool_name, request_description, request_options, response_option, response_time,
                available_modes, available_models, available_commands, current_mode_id, current_model_id,
                plan_entries, previous_mode_id, new_mode_id
            FROM entries
            WHERE session_id = ?1
            ORDER BY id DESC
            LIMIT 1
            "#,
            [session_id],
            |row| {
                Ok(DbEntry {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    entry_type: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    role: row.get(5)?,
                    content: row.get(6)?,
                    tool_call_id: row.get(7)?,
                    tool_name: row.get(8)?,
                    tool_status: row.get(9)?,
                    tool_input: row.get(10)?,
                    tool_output: row.get(11)?,
                    tool_title: row.get(12)?,
                    tool_kind: row.get(13)?,
                    request_id: row.get(14)?,
                    request_tool_name: row.get(15)?,
                    request_description: row.get(16)?,
                    request_options: row.get(17)?,
                    response_option: row.get(18)?,
                    response_time: row.get(19)?,
                    available_modes: row.get(20)?,
                    available_models: row.get(21)?,
                    available_commands: row.get(22)?,
                    current_mode_id: row.get(23)?,
                    current_model_id: row.get(24)?,
                    plan_entries: row.get(25)?,
                    previous_mode_id: row.get(26)?,
                    new_mode_id: row.get(27)?,
                })
            },
        )
        .optional()
    }

    /// Update message content (for chunk merging)
    pub fn update_message_content(&self, entry_id: i64, content: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE entries
            SET content = ?1, updated_at = ?2
            WHERE id = ?3 AND type = 'message'
            "#,
            params![content, now, entry_id],
        )?;
        Ok(())
    }

    // =========================================================================
    // Tool Call Updates (RULE 3, RULE 4)
    // =========================================================================

    /// Check if a tool call entry exists by tool_call_id (RULE 3 deduplication)
    pub fn tool_call_exists(&self, tool_call_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM entries WHERE tool_call_id = ?1 AND type = 'tool_call'",
            params![tool_call_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    /// Get the tool name for a tool call entry by tool_call_id
    /// Used by permission requests to show the actual tool name
    pub fn get_tool_name_by_call_id(&self, tool_call_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let result: std::result::Result<String, _> = conn.query_row(
            "SELECT tool_name FROM entries WHERE tool_call_id = ?1 AND type = 'tool_call'",
            params![tool_call_id],
            |row| row.get(0),
        );
        match result {
            Ok(name) => Ok(Some(name)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Update a tool call entry with new fields (RULE 3 deduplication update)
    pub fn update_tool_call_fields(
        &self,
        tool_call_id: &str,
        status: &str,
        title: Option<&str>,
        raw_input: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE entries
            SET tool_status = ?1,
                tool_title = COALESCE(?2, tool_title),
                tool_input = COALESCE(?3, tool_input),
                updated_at = ?4
            WHERE tool_call_id = ?5 AND type = 'tool_call'
            "#,
            params![status, title, raw_input, now, tool_call_id],
        )?;
        Ok(())
    }

    /// Update a tool call entry by tool_call_id (RULE 4)
    pub fn update_tool_call(&self, tool_call_id: &str, status: &str, output: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE entries
            SET tool_status = ?1, tool_output = ?2, updated_at = ?3
            WHERE tool_call_id = ?4 AND type = 'tool_call'
            "#,
            params![status, output, now, tool_call_id],
        )?;
        Ok(())
    }

    /// Update a tool call entry with title and output (RULE 4 extended)
    pub fn update_tool_call_with_title(
        &self,
        tool_call_id: &str,
        status: &str,
        title: Option<&str>,
        output: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE entries
            SET tool_status = ?1,
                tool_title = COALESCE(?2, tool_title),
                tool_output = ?3,
                updated_at = ?4
            WHERE tool_call_id = ?5 AND type = 'tool_call'
            "#,
            params![status, title, output, now, tool_call_id],
        )?;
        Ok(())
    }

    // =========================================================================
    // Permission Response (RULE 6)
    // =========================================================================

    /// Update a permission request with the user's response
    pub fn update_permission_response(&self, request_id: &str, option: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            r#"
            UPDATE entries
            SET response_option = ?1, response_time = ?2, updated_at = ?2
            WHERE request_id = ?3 AND type = 'permission_request'
            "#,
            params![option, now, request_id],
        )?;
        Ok(())
    }

    // =========================================================================
    // Combined Operations
    // =========================================================================

    /// Load a full session with all entries
    pub fn load_session(&self, session_id: &str) -> Result<Option<DbSessionWithEntries>> {
        let session = self.get_session(session_id)?;
        match session {
            Some(session) => {
                let entries = self.get_session_entries(session_id)?;
                Ok(Some(DbSessionWithEntries { session, entries }))
            }
            None => Ok(None),
        }
    }
}
