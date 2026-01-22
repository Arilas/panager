//! Tab Database Operations
//!
//! Provides CRUD operations for tabs and tab groups.
//! Uses the unified tab system with URL-based identification.
//!
//! See: apps/glide/src/lib/tabs/types.ts for TypeScript counterparts

use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::migrations;

/// Database file name within .glide directory
const DB_FILENAME: &str = "ide.db";

/// Directory name for glide data
const GLIDE_DIR: &str = ".glide";

/// Tab group stored in database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbTabGroup {
    pub id: String,
    pub position: i32,
    pub is_active: bool,
    pub created_at: i64,
}

/// Tab stored in database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbTab {
    pub id: Option<i64>,
    pub group_id: String,
    pub url: String,
    #[serde(rename = "type")]
    pub tab_type: String, // Resolver ID
    pub display_name: String,
    pub position: i32,
    pub is_pinned: bool,
    pub is_active: bool,
    pub is_preview: bool,

    // Session data
    pub cursor_line: Option<i32>,
    pub cursor_column: Option<i32>,
    pub scroll_top: Option<f64>,
    pub scroll_left: Option<f64>,
    pub selections: Option<String>,      // JSON
    pub folded_regions: Option<String>,  // JSON

    pub created_at: i64,
    pub updated_at: i64,
}

/// Tab session data for updates
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DbTabSession {
    pub cursor_line: Option<i32>,
    pub cursor_column: Option<i32>,
    pub scroll_top: Option<f64>,
    pub scroll_left: Option<f64>,
    pub selections: Option<String>,
    pub folded_regions: Option<String>,
}

/// Tabs database connection wrapper
pub struct TabsDb {
    conn: Mutex<Connection>,
    project_path: PathBuf,
}

impl TabsDb {
    /// Open or create a tabs database for a project
    pub fn open(project_path: &Path) -> Result<Self> {
        let db_dir = project_path.join(GLIDE_DIR);
        std::fs::create_dir_all(&db_dir).map_err(|e| {
            rusqlite::Error::InvalidPath(db_dir.join(format!("(create_dir failed: {})", e)))
        })?;

        // Create .gitignore in .glide directory if it doesn't exist
        let gitignore_path = db_dir.join(".gitignore");
        if !gitignore_path.exists() {
            let gitignore_content = r#"# Database files (user-specific session data)
ide.db
ide.db-journal
ide.db-wal
ide.db-shm
"#;
            let _ = std::fs::write(&gitignore_path, gitignore_content);
        }

        let db_path = db_dir.join(DB_FILENAME);
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

    /// Get the project path
    pub fn project_path(&self) -> &Path {
        &self.project_path
    }

    // ============================================================
    // Tab Group Operations
    // ============================================================

    /// Get all tab groups ordered by position
    pub fn get_groups(&self) -> Result<Vec<DbTabGroup>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, position, is_active, created_at
             FROM tab_groups
             ORDER BY position"
        )?;

        let groups = stmt.query_map([], |row| {
            Ok(DbTabGroup {
                id: row.get(0)?,
                position: row.get(1)?,
                is_active: row.get::<_, i32>(2)? != 0,
                created_at: row.get(3)?,
            })
        })?;

        groups.collect()
    }

    /// Create a new tab group
    pub fn create_group(&self, id: &str) -> Result<DbTabGroup> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        // Get next position
        let max_position: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) FROM tab_groups",
                [],
                |row| row.get(0),
            )
            .unwrap_or(-1);

        let position = max_position + 1;

        conn.execute(
            "INSERT INTO tab_groups (id, position, is_active, created_at)
             VALUES (?1, ?2, 0, ?3)",
            params![id, position, now],
        )?;

        Ok(DbTabGroup {
            id: id.to_string(),
            position,
            is_active: false,
            created_at: now,
        })
    }

    /// Delete a tab group (cascades to tabs)
    pub fn delete_group(&self, group_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tab_groups WHERE id = ?1", params![group_id])?;
        Ok(())
    }

    /// Set the active group
    pub fn set_active_group(&self, group_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Clear all active flags
        conn.execute("UPDATE tab_groups SET is_active = 0", [])?;
        // Set the specified group as active
        conn.execute(
            "UPDATE tab_groups SET is_active = 1 WHERE id = ?1",
            params![group_id],
        )?;
        Ok(())
    }

    /// Reorder groups by providing new order of IDs
    pub fn reorder_groups(&self, group_ids: &[String]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        for (position, id) in group_ids.iter().enumerate() {
            conn.execute(
                "UPDATE tab_groups SET position = ?1 WHERE id = ?2",
                params![position as i32, id],
            )?;
        }
        Ok(())
    }

    // ============================================================
    // Tab Operations
    // ============================================================

    /// Get all tabs for a group ordered by position
    pub fn get_tabs(&self, group_id: &str) -> Result<Vec<DbTab>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, group_id, url, type, display_name, position,
                    is_pinned, is_active, is_preview,
                    cursor_line, cursor_column, scroll_top, scroll_left,
                    selections, folded_regions, created_at, updated_at
             FROM tabs
             WHERE group_id = ?1
             ORDER BY position"
        )?;

        let tabs = stmt.query_map(params![group_id], |row| {
            Ok(DbTab {
                id: row.get(0)?,
                group_id: row.get(1)?,
                url: row.get(2)?,
                tab_type: row.get(3)?,
                display_name: row.get(4)?,
                position: row.get(5)?,
                is_pinned: row.get::<_, i32>(6)? != 0,
                is_active: row.get::<_, i32>(7)? != 0,
                is_preview: row.get::<_, i32>(8)? != 0,
                cursor_line: row.get(9)?,
                cursor_column: row.get(10)?,
                scroll_top: row.get(11)?,
                scroll_left: row.get(12)?,
                selections: row.get(13)?,
                folded_regions: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;

        tabs.collect()
    }

    /// Get all tabs across all groups
    pub fn get_all_tabs(&self) -> Result<Vec<DbTab>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, group_id, url, type, display_name, position,
                    is_pinned, is_active, is_preview,
                    cursor_line, cursor_column, scroll_top, scroll_left,
                    selections, folded_regions, created_at, updated_at
             FROM tabs
             ORDER BY group_id, position"
        )?;

        let tabs = stmt.query_map([], |row| {
            Ok(DbTab {
                id: row.get(0)?,
                group_id: row.get(1)?,
                url: row.get(2)?,
                tab_type: row.get(3)?,
                display_name: row.get(4)?,
                position: row.get(5)?,
                is_pinned: row.get::<_, i32>(6)? != 0,
                is_active: row.get::<_, i32>(7)? != 0,
                is_preview: row.get::<_, i32>(8)? != 0,
                cursor_line: row.get(9)?,
                cursor_column: row.get(10)?,
                scroll_top: row.get(11)?,
                scroll_left: row.get(12)?,
                selections: row.get(13)?,
                folded_regions: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;

        tabs.collect()
    }

    /// Save a tab (insert or update)
    pub fn save_tab(&self, tab: &DbTab) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        // Try to find existing tab by group_id and url
        let existing_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM tabs WHERE group_id = ?1 AND url = ?2",
                params![&tab.group_id, &tab.url],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(id) = existing_id {
            // Update existing tab
            conn.execute(
                "UPDATE tabs SET
                    type = ?1, display_name = ?2, position = ?3,
                    is_pinned = ?4, is_active = ?5, is_preview = ?6,
                    cursor_line = ?7, cursor_column = ?8,
                    scroll_top = ?9, scroll_left = ?10,
                    selections = ?11, folded_regions = ?12,
                    updated_at = ?13
                 WHERE id = ?14",
                params![
                    &tab.tab_type,
                    &tab.display_name,
                    tab.position,
                    tab.is_pinned as i32,
                    tab.is_active as i32,
                    tab.is_preview as i32,
                    tab.cursor_line,
                    tab.cursor_column,
                    tab.scroll_top,
                    tab.scroll_left,
                    &tab.selections,
                    &tab.folded_regions,
                    now,
                    id,
                ],
            )?;
            Ok(id)
        } else {
            // Insert new tab
            conn.execute(
                "INSERT INTO tabs (
                    group_id, url, type, display_name, position,
                    is_pinned, is_active, is_preview,
                    cursor_line, cursor_column, scroll_top, scroll_left,
                    selections, folded_regions, created_at, updated_at
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16
                 )",
                params![
                    &tab.group_id,
                    &tab.url,
                    &tab.tab_type,
                    &tab.display_name,
                    tab.position,
                    tab.is_pinned as i32,
                    tab.is_active as i32,
                    tab.is_preview as i32,
                    tab.cursor_line,
                    tab.cursor_column,
                    tab.scroll_top,
                    tab.scroll_left,
                    &tab.selections,
                    &tab.folded_regions,
                    now,
                    now,
                ],
            )?;
            Ok(conn.last_insert_rowid())
        }
    }

    /// Update tab URL (e.g., chat://new -> chat://session-id)
    pub fn update_tab_url(
        &self,
        group_id: &str,
        old_url: &str,
        new_url: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE tabs SET url = ?1, updated_at = ?2
             WHERE group_id = ?3 AND url = ?4",
            params![new_url, now, group_id, old_url],
        )?;
        Ok(())
    }

    /// Delete a tab
    pub fn delete_tab(&self, group_id: &str, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM tabs WHERE group_id = ?1 AND url = ?2",
            params![group_id, url],
        )?;
        Ok(())
    }

    /// Set the active tab within a group
    pub fn set_active_tab(&self, group_id: &str, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Clear all active flags in the group
        conn.execute(
            "UPDATE tabs SET is_active = 0 WHERE group_id = ?1",
            params![group_id],
        )?;
        // Set the specified tab as active
        conn.execute(
            "UPDATE tabs SET is_active = 1 WHERE group_id = ?1 AND url = ?2",
            params![group_id, url],
        )?;
        Ok(())
    }

    /// Reorder tabs by providing new order of URLs
    pub fn reorder_tabs(&self, group_id: &str, urls: &[String]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        for (position, url) in urls.iter().enumerate() {
            conn.execute(
                "UPDATE tabs SET position = ?1, updated_at = ?2
                 WHERE group_id = ?3 AND url = ?4",
                params![position as i32, now, group_id, url],
            )?;
        }
        Ok(())
    }

    /// Move a tab to a different group
    pub fn move_tab_to_group(
        &self,
        url: &str,
        from_group: &str,
        to_group: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        // Get max position in target group
        let max_position: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) FROM tabs WHERE group_id = ?1",
                params![to_group],
                |row| row.get(0),
            )
            .unwrap_or(-1);

        conn.execute(
            "UPDATE tabs SET group_id = ?1, position = ?2, is_active = 0, updated_at = ?3
             WHERE group_id = ?4 AND url = ?5",
            params![to_group, max_position + 1, now, from_group, url],
        )?;
        Ok(())
    }

    /// Update tab session data (cursor, scroll, etc.)
    pub fn update_tab_session(
        &self,
        group_id: &str,
        url: &str,
        session: &DbTabSession,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE tabs SET
                cursor_line = ?1, cursor_column = ?2,
                scroll_top = ?3, scroll_left = ?4,
                selections = ?5, folded_regions = ?6,
                updated_at = ?7
             WHERE group_id = ?8 AND url = ?9",
            params![
                session.cursor_line,
                session.cursor_column,
                session.scroll_top,
                session.scroll_left,
                &session.selections,
                &session.folded_regions,
                now,
                group_id,
                url,
            ],
        )?;
        Ok(())
    }

    /// Pin or unpin a tab
    pub fn set_tab_pinned(&self, group_id: &str, url: &str, pinned: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE tabs SET is_pinned = ?1, updated_at = ?2
             WHERE group_id = ?3 AND url = ?4",
            params![pinned as i32, now, group_id, url],
        )?;
        Ok(())
    }

    /// Convert a preview tab to a permanent tab
    pub fn convert_preview_to_permanent(&self, group_id: &str, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE tabs SET is_preview = 0, updated_at = ?1
             WHERE group_id = ?2 AND url = ?3",
            params![now, group_id, url],
        )?;
        Ok(())
    }

    /// Delete all preview tabs in a group
    pub fn delete_preview_tabs(&self, group_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM tabs WHERE group_id = ?1 AND is_preview = 1",
            params![group_id],
        )?;
        Ok(())
    }

    /// Clear all tabs and groups (for testing or reset)
    pub fn clear_all(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tabs", [])?;
        conn.execute("DELETE FROM tab_groups", [])?;
        Ok(())
    }
}
