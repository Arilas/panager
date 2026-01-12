//! Linux-specific editor detection and launching
//!
//! This module handles detection of editors installed via Linux-specific
//! mechanisms: Flatpak, Snap, JetBrains Toolbox, and AppImages.

use crate::platform::traits::EditorInfo;
use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

/// Flatpak applications with their app IDs
const FLATPAK_APPS: &[(&str, &str, &str)] = &[
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

/// Snap applications with their paths
const SNAP_APPS: &[(&str, &str, &str)] = &[
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

/// JetBrains Toolbox editors
const JETBRAINS_EDITORS: &[(&str, &str)] = &[
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

/// AppImage patterns to search for
const APPIMAGE_PATTERNS: &[(&str, &str, &str)] = &[
    ("cursor", "Cursor", "cursor"),
    ("zed", "Zed", "zed"),
    ("code", "VS Code", "code"),
    ("neovim", "Neovim", "nvim"),
];

/// Validate Flatpak app ID format
///
/// Valid format: reverse domain notation like "com.visualstudio.code"
pub fn is_valid_flatpak_app_id(app_id: &str) -> bool {
    let parts: Vec<&str> = app_id.split('.').collect();
    if parts.len() < 3 {
        return false;
    }

    parts.iter().all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    })
}

/// Detect all Linux-specific editors
pub fn detect_linux_editors(detected_commands: &HashSet<String>) -> Vec<EditorInfo> {
    let mut editors = Vec::new();
    let mut local_detected = detected_commands.clone();

    // Detect Flatpak installations
    detect_flatpak_editors(&mut editors, &mut local_detected);

    // Detect Snap installations
    detect_snap_editors(&mut editors, &mut local_detected);

    // Detect JetBrains Toolbox installations
    detect_toolbox_editors(&mut editors, &mut local_detected);

    // Detect AppImage installations
    detect_appimage_editors(&mut editors, &mut local_detected);

    editors
}

/// Detect Flatpak-installed editors
fn detect_flatpak_editors(editors: &mut Vec<EditorInfo>, detected: &mut HashSet<String>) {
    for (app_id, name, base_cmd) in FLATPAK_APPS {
        if !is_valid_flatpak_app_id(app_id) || detected.contains(*base_cmd) {
            continue;
        }

        let flatpak_check = Command::new("flatpak")
            .args(["info", app_id])
            .output();

        if let Ok(output) = flatpak_check {
            if output.status.success() {
                editors.push(EditorInfo {
                    name: format!("{} (Flatpak)", name),
                    command: format!("flatpak run {}", app_id),
                    icon: None,
                });
                detected.insert(base_cmd.to_string());
            }
        }
    }
}

/// Detect Snap-installed editors
fn detect_snap_editors(editors: &mut Vec<EditorInfo>, detected: &mut HashSet<String>) {
    for (path, name, base_cmd) in SNAP_APPS {
        if detected.contains(*base_cmd) {
            continue;
        }

        if Path::new(path).exists() {
            editors.push(EditorInfo {
                name: format!("{} (Snap)", name),
                command: path.to_string(),
                icon: None,
            });
            detected.insert(base_cmd.to_string());
        }
    }
}

/// Detect JetBrains Toolbox-installed editors
fn detect_toolbox_editors(editors: &mut Vec<EditorInfo>, detected: &mut HashSet<String>) {
    let Some(home) = home::home_dir() else {
        return;
    };

    let toolbox_dir = home.join(".local/share/JetBrains/Toolbox/scripts");
    if !toolbox_dir.exists() {
        return;
    }

    for (cmd, name) in JETBRAINS_EDITORS {
        if detected.contains(*cmd) {
            continue;
        }

        let script_path = toolbox_dir.join(cmd);
        if script_path.exists() {
            editors.push(EditorInfo {
                name: format!("{} (Toolbox)", name),
                command: script_path.to_string_lossy().to_string(),
                icon: None,
            });
            detected.insert(cmd.to_string());
        }
    }
}

/// Detect AppImage editors in common locations
fn detect_appimage_editors(editors: &mut Vec<EditorInfo>, detected: &mut HashSet<String>) {
    let Some(home) = home::home_dir() else {
        return;
    };

    let appimage_dirs = [
        home.join("Applications"),
        home.join(".local/bin"),
        home.join("AppImages"),
    ];

    for dir in &appimage_dirs {
        if !dir.exists() {
            continue;
        }

        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();

            if !filename.ends_with(".appimage") {
                continue;
            }

            for (pattern, name, base_cmd) in APPIMAGE_PATTERNS {
                if filename.contains(pattern) && !detected.contains(*base_cmd) {
                    editors.push(EditorInfo {
                        name: format!("{} (AppImage)", name),
                        command: path.to_string_lossy().to_string(),
                        icon: None,
                    });
                    detected.insert(base_cmd.to_string());
                    break;
                }
            }
        }
    }
}

/// Generate Linux-specific error message for failed editor launch
pub fn open_with_fallback(command: &str, _project_path: &str, original_error: &str) -> Result<(), String> {
    Err(format!(
        "Failed to open editor '{}': {}. Make sure the editor is installed. \
        For Flatpak apps, ensure they're installed via 'flatpak install'. \
        For Snap apps, ensure they're installed via 'snap install'.",
        command, original_error
    ))
}
