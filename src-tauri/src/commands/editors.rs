use crate::db::models::Editor;
use crate::db::Database;
use chrono::Utc;
use std::process::Command;
use tauri::State;
use uuid::Uuid;
use which::which;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EditorInfo {
    pub name: String,
    pub command: String,
    pub icon: Option<String>,
}

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

#[tauri::command]
pub fn detect_editors() -> Vec<EditorInfo> {
    let mut detected = Vec::new();

    for editor in KNOWN_EDITORS {
        if which(editor.command).is_ok() {
            detected.push(EditorInfo {
                name: editor.name.to_string(),
                command: editor.command.to_string(),
                icon: None,
            });
        }
    }

    // Also check macOS-specific paths
    #[cfg(target_os = "macos")]
    {
        use std::path::Path;

        let macos_apps = [
            ("/Applications/Visual Studio Code.app", "Visual Studio Code", "code"),
            ("/Applications/Cursor.app", "Cursor", "cursor"),
            ("/Applications/WebStorm.app", "WebStorm", "webstorm"),
            ("/Applications/IntelliJ IDEA.app", "IntelliJ IDEA", "idea"),
            ("/Applications/Zed.app", "Zed", "zed"),
            ("/Applications/Sublime Text.app", "Sublime Text", "subl"),
            ("/Applications/Fleet.app", "Fleet", "fleet"),
        ];

        for (path, name, cmd) in macos_apps {
            if Path::new(path).exists() && !detected.iter().any(|e| e.command == cmd) {
                detected.push(EditorInfo {
                    name: name.to_string(),
                    command: cmd.to_string(),
                    icon: None,
                });
            }
        }
    }

    detected
}

#[tauri::command]
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

#[tauri::command]
pub fn get_editors(db: State<Database>) -> Result<Vec<Editor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_editors_internal(&conn)
}

#[tauri::command]
pub fn add_editor(
    db: State<Database>,
    name: String,
    command: String,
    icon: Option<String>,
) -> Result<Editor, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Check if command exists
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

#[tauri::command]
pub fn delete_editor(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM editors WHERE id = ?1 AND is_auto_detected = 0",
        [&id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_in_editor(editor_command: String, project_path: String) -> Result<(), String> {
    // Try to spawn the command directly first
    let result = Command::new(&editor_command)
        .arg(&project_path)
        .spawn();

    match result {
        Ok(_) => Ok(()),
        Err(e) => {
            // On macOS, try using 'open' command as fallback
            #[cfg(target_os = "macos")]
            {
                // Map common editor commands to their macOS app names
                let app_name = match editor_command.as_str() {
                    "code" => Some("Visual Studio Code"),
                    "cursor" => Some("Cursor"),
                    "zed" => Some("Zed"),
                    "subl" => Some("Sublime Text"),
                    "webstorm" => Some("WebStorm"),
                    "idea" => Some("IntelliJ IDEA"),
                    "pycharm" => Some("PyCharm"),
                    "goland" => Some("GoLand"),
                    "clion" => Some("CLion"),
                    "phpstorm" => Some("PhpStorm"),
                    "rubymine" => Some("RubyMine"),
                    "fleet" => Some("Fleet"),
                    "studio" => Some("Android Studio"),
                    _ => None,
                };

                if let Some(app) = app_name {
                    // Try opening with the app name
                    let open_result = Command::new("open")
                        .arg("-a")
                        .arg(app)
                        .arg(&project_path)
                        .spawn();

                    if open_result.is_ok() {
                        return Ok(());
                    }
                }

                // Last resort: try opening the project folder directly
                // This will open it in Finder or the default handler
                Err(format!("Failed to open editor '{}': {}. Make sure the editor is installed and its CLI is in PATH.", editor_command, e))
            }

            #[cfg(not(target_os = "macos"))]
            {
                Err(format!("Failed to open editor '{}': {}", editor_command, e))
            }
        }
    }
}

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
