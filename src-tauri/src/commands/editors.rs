use crate::db::models::Editor;
use crate::db::Database;
use chrono::Utc;
use std::collections::HashSet;
use std::process::Command;
use tauri::State;
use uuid::Uuid;
use which::which;

/// Extract the base command name from a command string or path.
/// For example:
/// - "/snap/bin/code" -> "code"
/// - "flatpak run com.visualstudio.code" -> "code" (via base_cmd parameter)
/// - "/home/user/.local/share/JetBrains/Toolbox/scripts/idea" -> "idea"
#[allow(dead_code)]
fn get_base_command_name(command: &str) -> &str {
    // For paths, extract the filename
    if command.contains('/') {
        command.rsplit('/').next().unwrap_or(command)
    } else {
        command
    }
}

/// Validate Flatpak app ID format.
/// Valid format: reverse domain notation like "com.visualstudio.code"
fn is_valid_flatpak_app_id(app_id: &str) -> bool {
    // Must have at least two dots (three parts)
    let parts: Vec<&str> = app_id.split('.').collect();
    if parts.len() < 2 {
        return false;
    }

    // Each part must be non-empty and contain only alphanumeric, underscore, or hyphen
    parts.iter().all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
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
#[specta::specta]
pub fn detect_editors() -> Vec<EditorInfo> {
    let mut detected = Vec::new();
    // Track detected base commands to prevent duplicates across installation methods
    let mut detected_base_cmds: HashSet<String> = HashSet::new();

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
            if Path::new(path).exists() && !detected_base_cmds.contains(cmd) {
                detected.push(EditorInfo {
                    name: name.to_string(),
                    command: cmd.to_string(),
                    icon: None,
                });
                detected_base_cmds.insert(cmd.to_string());
            }
        }
    }

    // Also check Linux-specific paths (Flatpak, Snap, native installations)
    #[cfg(target_os = "linux")]
    {
        use std::path::Path;

        // Check for Flatpak installations
        // Flatpak apps are accessed via: flatpak run <app-id>
        let flatpak_apps = [
            ("com.visualstudio.code", "Visual Studio Code", "code"),
            ("com.vscodium.codium", "VSCodium", "codium"),
            ("dev.zed.Zed", "Zed", "zed"),
            ("com.sublimetext.three", "Sublime Text", "subl"),
            ("io.neovim.nvim", "Neovim", "nvim"),
            ("com.jetbrains.IntelliJ-IDEA-Community", "IntelliJ IDEA CE", "idea"),
            ("com.jetbrains.IntelliJ-IDEA-Ultimate", "IntelliJ IDEA", "idea"),
            ("com.jetbrains.WebStorm", "WebStorm", "webstorm"),
            ("com.jetbrains.PyCharm-Community", "PyCharm CE", "pycharm"),
            ("com.jetbrains.PyCharm-Professional", "PyCharm", "pycharm"),
            ("com.jetbrains.GoLand", "GoLand", "goland"),
            ("com.jetbrains.CLion", "CLion", "clion"),
            ("com.jetbrains.PhpStorm", "PhpStorm", "phpstorm"),
            ("com.jetbrains.RubyMine", "RubyMine", "rubymine"),
        ];

        for (app_id, name, base_cmd) in flatpak_apps {
            // Validate app_id format to prevent command injection
            if !is_valid_flatpak_app_id(app_id) {
                continue;
            }

            // Skip if we already detected this editor via another method
            if detected_base_cmds.contains(base_cmd) {
                continue;
            }

            // Check if flatpak app is installed
            let flatpak_check = Command::new("flatpak")
                .args(["info", app_id])
                .output();

            if let Ok(output) = flatpak_check {
                if output.status.success() {
                    // Use flatpak run command for launching
                    detected.push(EditorInfo {
                        name: format!("{} (Flatpak)", name),
                        command: format!("flatpak run {}", app_id),
                        icon: None,
                    });
                    detected_base_cmds.insert(base_cmd.to_string());
                }
            }
        }

        // Check for Snap installations
        let snap_apps = [
            ("/snap/bin/code", "Visual Studio Code", "code"),
            ("/snap/bin/codium", "VSCodium", "codium"),
            ("/snap/bin/sublime-text", "Sublime Text", "subl"),
            ("/snap/bin/nvim", "Neovim", "nvim"),
            ("/snap/bin/intellij-idea-community", "IntelliJ IDEA CE", "idea"),
            ("/snap/bin/intellij-idea-ultimate", "IntelliJ IDEA", "idea"),
            ("/snap/bin/pycharm-community", "PyCharm CE", "pycharm"),
            ("/snap/bin/pycharm-professional", "PyCharm", "pycharm"),
            ("/snap/bin/goland", "GoLand", "goland"),
            ("/snap/bin/webstorm", "WebStorm", "webstorm"),
            ("/snap/bin/clion", "CLion", "clion"),
            ("/snap/bin/phpstorm", "PhpStorm", "phpstorm"),
            ("/snap/bin/rubymine", "RubyMine", "rubymine"),
            ("/snap/bin/rider", "Rider", "rider"),
            ("/snap/bin/datagrip", "DataGrip", "datagrip"),
        ];

        for (path, name, base_cmd) in snap_apps {
            // Skip if we already detected this editor via another method
            if detected_base_cmds.contains(base_cmd) {
                continue;
            }

            if Path::new(path).exists() {
                detected.push(EditorInfo {
                    name: format!("{} (Snap)", name),
                    command: path.to_string(),
                    icon: None,
                });
                detected_base_cmds.insert(base_cmd.to_string());
            }
        }

        // Check JetBrains Toolbox installations
        // Toolbox installs scripts to ~/.local/share/JetBrains/Toolbox/scripts/
        if let Some(home) = home::home_dir() {
            let toolbox_dir = home.join(".local/share/JetBrains/Toolbox/scripts");
            if toolbox_dir.exists() {
                let jetbrains_editors = [
                    ("idea", "IntelliJ IDEA"),
                    ("webstorm", "WebStorm"),
                    ("pycharm", "PyCharm"),
                    ("goland", "GoLand"),
                    ("clion", "CLion"),
                    ("phpstorm", "PhpStorm"),
                    ("rubymine", "RubyMine"),
                    ("rider", "Rider"),
                    ("datagrip", "DataGrip"),
                    ("fleet", "Fleet"),
                ];

                for (cmd, name) in jetbrains_editors {
                    // Skip if we already detected this editor via another method
                    if detected_base_cmds.contains(cmd) {
                        continue;
                    }

                    let script_path = toolbox_dir.join(cmd);
                    if script_path.exists() {
                        detected.push(EditorInfo {
                            name: format!("{} (Toolbox)", name),
                            command: script_path.to_string_lossy().to_string(),
                            icon: None,
                        });
                        detected_base_cmds.insert(cmd.to_string());
                    }
                }
            }
        }

        // Check for AppImage installations in common locations
        if let Some(home) = home::home_dir() {
            let appimage_dirs = [
                home.join("Applications"),
                home.join(".local/bin"),
                home.join("AppImages"),
            ];

            // Common AppImage patterns (lowercase for matching)
            let appimage_patterns = [
                ("cursor", "Cursor", "cursor"),
                ("zed", "Zed", "zed"),
                ("code", "VS Code", "code"),
                ("neovim", "Neovim", "nvim"),
            ];

            for dir in &appimage_dirs {
                if dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();

                            // Check if it's an AppImage
                            if !filename.ends_with(".appimage") {
                                continue;
                            }

                            for (pattern, name, base_cmd) in &appimage_patterns {
                                if filename.contains(pattern) {
                                    // Skip if we already detected this editor via another method
                                    if detected_base_cmds.contains(*base_cmd) {
                                        break;
                                    }

                                    let path_str = path.to_string_lossy().to_string();
                                    detected.push(EditorInfo {
                                        name: format!("{} (AppImage)", name),
                                        command: path_str,
                                        icon: None,
                                    });
                                    detected_base_cmds.insert(base_cmd.to_string());
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    detected
}

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

#[tauri::command]
#[specta::specta]
pub fn get_editors(db: State<Database>) -> Result<Vec<Editor>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_editors_internal(&conn)
}

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

#[tauri::command]
#[specta::specta]
pub fn open_in_editor(editor_command: String, project_path: String) -> Result<(), String> {
    // Handle flatpak commands specially (they contain spaces)
    if editor_command.starts_with("flatpak run ") {
        let parts: Vec<&str> = editor_command.splitn(3, ' ').collect();
        if parts.len() >= 3 {
            let app_id = parts[2];

            // Validate app_id format to prevent command injection
            if !is_valid_flatpak_app_id(app_id) {
                return Err(format!("Invalid Flatpak app ID format: {}", app_id));
            }

            let result = Command::new("flatpak")
                .args(["run", app_id, &project_path])
                .spawn();

            return match result {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to open Flatpak editor '{}': {}", app_id, e)),
            };
        }
    }

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

            // On Linux, try xdg-open as a last resort fallback
            #[cfg(target_os = "linux")]
            {
                // Try using xdg-open to open in the default file manager as absolute last resort
                // This is not ideal but provides some feedback to the user
                Err(format!(
                    "Failed to open editor '{}': {}. Make sure the editor is installed. \
                    For Flatpak apps, ensure they're installed via 'flatpak install'. \
                    For Snap apps, ensure they're installed via 'snap install'.",
                    editor_command, e
                ))
            }

            #[cfg(not(any(target_os = "macos", target_os = "linux")))]
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
