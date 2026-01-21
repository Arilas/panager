//! Terminal detection and management commands
//!
//! This module provides Tauri commands for detecting installed terminal emulators,
//! managing the terminal database, and opening projects in terminals.

use crate::db::models::Terminal;
use crate::db::Database;
use crate::platform::traits::TerminalInfo;
use chrono::Utc;
use std::collections::HashSet;
use tauri::State;
use uuid::Uuid;

/// Detect all installed terminal emulators
///
/// Detection order:
/// 1. Platform-specific detection (macOS: /Applications, Linux: PATH/Flatpak)
#[tauri::command]
#[specta::specta]
pub fn detect_terminals() -> Vec<TerminalInfo> {
    let mut detected = Vec::new();
    let detected_commands: HashSet<String> = HashSet::new();

    #[cfg(target_os = "macos")]
    detected.extend(crate::platform::macos::terminals::detect_macos_terminals(
        &detected_commands,
    ));

    #[cfg(target_os = "linux")]
    detected.extend(crate::platform::linux::terminals::detect_linux_terminals(
        &detected_commands,
    ));

    #[cfg(target_os = "windows")]
    {
        // Windows Terminal detection
        if which::which("wt").is_ok() {
            detected.push(TerminalInfo {
                name: "Windows Terminal".to_string(),
                command: "wt".to_string(),
                exec_template: "wt -d {path}".to_string(),
            });
        }
        // PowerShell is always available
        detected.push(TerminalInfo {
            name: "PowerShell".to_string(),
            command: "powershell".to_string(),
            exec_template: "powershell -NoExit -Command \"cd '{path}'\"".to_string(),
        });
        // cmd is always available
        detected.push(TerminalInfo {
            name: "Command Prompt".to_string(),
            command: "cmd".to_string(),
            exec_template: "cmd /K cd /d {path}".to_string(),
        });
    }

    detected
}

/// Sync detected terminals with the database
#[tauri::command]
#[specta::specta]
pub fn sync_terminals(db: State<Database>) -> Result<Vec<Terminal>, String> {
    let detected = detect_terminals();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    // Mark all auto-detected terminals as unavailable first
    conn.execute(
        "UPDATE terminals SET is_available = 0 WHERE is_auto_detected = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Insert or update detected terminals
    for terminal in &detected {
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM terminals WHERE command = ?1 AND is_auto_detected = 1",
                [&terminal.command],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing {
            conn.execute(
                "UPDATE terminals SET is_available = 1, name = ?1, exec_template = ?2 WHERE id = ?3",
                (&terminal.name, &terminal.exec_template, &id),
            )
            .map_err(|e| e.to_string())?;
        } else {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                r#"
                INSERT INTO terminals (id, name, command, exec_template, is_auto_detected, is_available, created_at)
                VALUES (?1, ?2, ?3, ?4, 1, 1, ?5)
                "#,
                (
                    &id,
                    &terminal.name,
                    &terminal.command,
                    &terminal.exec_template,
                    now.to_rfc3339(),
                ),
            )
            .map_err(|e| e.to_string())?;
        }
    }

    get_terminals_internal(&conn)
}

/// Get all available terminals from the database
#[tauri::command]
#[specta::specta]
pub fn get_terminals(db: State<Database>) -> Result<Vec<Terminal>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_terminals_internal(&conn)
}

/// Internal helper to get terminals from database
fn get_terminals_internal(conn: &rusqlite::Connection) -> Result<Vec<Terminal>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, command, exec_template, is_auto_detected, is_available, created_at
            FROM terminals WHERE is_available = 1
            ORDER BY name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let terminals = stmt
        .query_map([], |row| {
            Ok(Terminal {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                exec_template: row.get(3)?,
                is_auto_detected: row.get::<_, i32>(4)? != 0,
                is_available: row.get::<_, i32>(5)? != 0,
                created_at: row
                    .get::<_, String>(6)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(terminals)
}
