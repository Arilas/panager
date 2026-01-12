//! Editor detection and management commands
//!
//! This module provides Tauri commands for detecting installed editors,
//! managing the editor database, and opening projects in editors.

use crate::db::models::Editor;
use crate::db::Database;
use crate::platform::traits::EditorInfo;
use chrono::Utc;
use std::collections::HashSet;
use std::process::Command;
use tauri::State;
use uuid::Uuid;
use which::which;

/// Known editors for PATH-based detection (cross-platform)
struct KnownEditor {
    name: &'static str,
    command: &'static str,
}

const KNOWN_EDITORS: &[KnownEditor] = &[
    KnownEditor { name: "Visual Studio Code", command: "code" },
    KnownEditor { name: "Cursor", command: "cursor" },
    KnownEditor { name: "WebStorm", command: "webstorm" },
    KnownEditor { name: "IntelliJ IDEA", command: "idea" },
    KnownEditor { name: "Zed", command: "zed" },
    KnownEditor { name: "Sublime Text", command: "subl" },
    KnownEditor { name: "Neovim", command: "nvim" },
    KnownEditor { name: "Vim", command: "vim" },
    KnownEditor { name: "Fleet", command: "fleet" },
    KnownEditor { name: "PyCharm", command: "pycharm" },
    KnownEditor { name: "GoLand", command: "goland" },
    KnownEditor { name: "RubyMine", command: "rubymine" },
    KnownEditor { name: "PhpStorm", command: "phpstorm" },
    KnownEditor { name: "CLion", command: "clion" },
    KnownEditor { name: "Android Studio", command: "studio" },
];

/// Detect all installed editors
///
/// Detection order:
/// 1. PATH-based detection (cross-platform)
/// 2. Platform-specific detection (macOS: /Applications, Linux: Flatpak/Snap/etc)
#[tauri::command]
#[specta::specta]
pub fn detect_editors() -> Vec<EditorInfo> {
    let mut detected = Vec::new();
    let mut detected_base_cmds: HashSet<String> = HashSet::new();

    // 1. PATH-based detection (cross-platform)
    for editor in KNOWN_EDITORS {
        if which(editor.command).is_ok() {
            detected.push(EditorInfo {
                name: editor.name.to_string(),
                command: editor.command.to_string(),
                icon: None,
            });
            detected_base_cmds.insert(editor.command.to_string());
        }
    }

    // 2. Platform-specific detection
    #[cfg(target_os = "macos")]
    {
        let platform_editors = crate::platform::macos::editors::detect_macos_editors(&detected_base_cmds);
        for editor in platform_editors {
            detected_base_cmds.insert(editor.command.clone());
            detected.push(editor);
        }
    }

    #[cfg(target_os = "linux")]
    {
        let platform_editors = crate::platform::linux::editors::detect_linux_editors(&detected_base_cmds);
        for editor in platform_editors {
            detected.push(editor);
        }
    }

    detected
}

/// Sync detected editors with the database
#[tauri::command]
#[specta::specta]
pub fn sync_editors(db: State<Database>) -> Result<Vec<Editor>, String> {
    let detected = detect_editors();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    // Mark all auto-detected editors as unavailable first
    conn.execute(
        "UPDATE editors SET is_available = 0 WHERE is_auto_detected = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Insert or update detected editors
    for editor in &detected {
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM editors WHERE command = ?1 AND is_auto_detected = 1",
                [&editor.command],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing {
            conn.execute(
                "UPDATE editors SET is_available = 1, name = ?1 WHERE id = ?2",
                (&editor.name, &id),
            )
            .map_err(|e| e.to_string())?;
        } else {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                r#"
                INSERT INTO editors (id, name, command, icon, is_auto_detected, is_available, created_at)
                VALUES (?1, ?2, ?3, ?4, 1, 1, ?5)
                "#,
                (&id, &editor.name, &editor.command, &editor.icon, now.to_rfc3339()),
            )
            .map_err(|e| e.to_string())?;
        }
    }

    get_editors_internal(&conn)
}

/// Get all available editors from the database
#[tauri::command]
#[specta::specta]
pub fn get_editors(db: State<Database>) -> Result<Vec<Editor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_editors_internal(&conn)
}

/// Add a custom editor
#[tauri::command]
#[specta::specta]
pub fn add_editor(
    db: State<Database>,
    name: String,
    command: String,
    icon: Option<String>,
) -> Result<Editor, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let is_available = which(&command).is_ok();

    conn.execute(
        r#"
        INSERT INTO editors (id, name, command, icon, is_auto_detected, is_available, created_at)
        VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
        "#,
        (&id, &name, &command, &icon, is_available as i32, now.to_rfc3339()),
    )
    .map_err(|e| e.to_string())?;

    Ok(Editor {
        id,
        name,
        command,
        icon,
        is_auto_detected: false,
        is_available,
        created_at: now,
    })
}

/// Delete a custom editor (only non-auto-detected)
#[tauri::command]
#[specta::specta]
pub fn delete_editor(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM editors WHERE id = ?1 AND is_auto_detected = 0",
        [&id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Open a project in an editor
#[tauri::command]
#[specta::specta]
pub fn open_in_editor(editor_command: String, project_path: String) -> Result<(), String> {
    // Handle Flatpak commands (Linux-only, they contain spaces like "flatpak run com.app.Id")
    #[cfg(target_os = "linux")]
    if editor_command.starts_with("flatpak run ") {
        let parts: Vec<&str> = editor_command.splitn(3, ' ').collect();
        if parts.len() >= 3 {
            let app_id = parts[2];

            if !crate::platform::linux::editors::is_valid_flatpak_app_id(app_id) {
                return Err(format!("Invalid Flatpak app ID format: {}", app_id));
            }

            return Command::new("flatpak")
                .args(["run", app_id, &project_path])
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open Flatpak editor '{}': {}", app_id, e));
        }
    }

    // Try to spawn the command directly
    Command::new(&editor_command)
        .arg(&project_path)
        .spawn()
        .map(|_| ())
        .or_else(|e| {
            let error_str = e.to_string();

            #[cfg(target_os = "macos")]
            return crate::platform::macos::editors::open_with_fallback(
                &editor_command,
                &project_path,
                &error_str,
            );

            #[cfg(target_os = "linux")]
            return crate::platform::linux::editors::open_with_fallback(
                &editor_command,
                &project_path,
                &error_str,
            );

            #[cfg(not(any(target_os = "macos", target_os = "linux")))]
            Err(format!("Failed to open editor '{}': {}", editor_command, e))
        })
}

/// Internal helper to get editors from database
fn get_editors_internal(conn: &rusqlite::Connection) -> Result<Vec<Editor>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, command, icon, is_auto_detected, is_available, created_at
            FROM editors WHERE is_available = 1
            ORDER BY name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let editors = stmt
        .query_map([], |row| {
            Ok(Editor {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                icon: row.get(3)?,
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

    Ok(editors)
}
