//! macOS-specific editor detection and launching
//!
//! This module handles detection of editors installed via macOS-specific
//! mechanisms (e.g., /Applications) and provides fallback launching via
//! the `open -a` command.

use crate::platform::traits::EditorInfo;
use std::path::Path;
use std::process::Command;

/// macOS application paths for common editors
const MACOS_APPS: &[(&str, &str, &str)] = &[
    ("/Applications/Visual Studio Code.app", "Visual Studio Code", "code"),
    ("/Applications/Cursor.app", "Cursor", "cursor"),
    ("/Applications/WebStorm.app", "WebStorm", "webstorm"),
    ("/Applications/IntelliJ IDEA.app", "IntelliJ IDEA", "idea"),
    ("/Applications/Zed.app", "Zed", "zed"),
    ("/Applications/Sublime Text.app", "Sublime Text", "subl"),
    ("/Applications/Fleet.app", "Fleet", "fleet"),
    ("/Applications/PyCharm.app", "PyCharm", "pycharm"),
    ("/Applications/GoLand.app", "GoLand", "goland"),
    ("/Applications/CLion.app", "CLion", "clion"),
    ("/Applications/PhpStorm.app", "PhpStorm", "phpstorm"),
    ("/Applications/RubyMine.app", "RubyMine", "rubymine"),
    ("/Applications/Android Studio.app", "Android Studio", "studio"),
];

/// Detect editors installed in /Applications
pub fn detect_macos_editors(detected_commands: &std::collections::HashSet<String>) -> Vec<EditorInfo> {
    let mut editors = Vec::new();

    for (path, name, cmd) in MACOS_APPS {
        if Path::new(path).exists() && !detected_commands.contains(*cmd) {
            editors.push(EditorInfo {
                name: name.to_string(),
                command: cmd.to_string(),
                icon: None,
            });
        }
    }

    editors
}

/// Get the macOS app name for a command (for `open -a` fallback)
pub fn get_app_name_for_command(command: &str) -> Option<&'static str> {
    match command {
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
    }
}

/// Try to open a project using macOS `open -a` command
pub fn open_with_fallback(command: &str, project_path: &str, original_error: &str) -> Result<(), String> {
    if let Some(app) = get_app_name_for_command(command) {
        let result = Command::new("open")
            .arg("-a")
            .arg(app)
            .arg(project_path)
            .spawn();

        if result.is_ok() {
            return Ok(());
        }
    }

    Err(format!(
        "Failed to open editor '{}': {}. Make sure the editor is installed and its CLI is in PATH.",
        command, original_error
    ))
}
