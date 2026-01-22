//! macOS-specific terminal detection and launching
//!
//! This module handles detection of terminal emulators installed via macOS-specific
//! mechanisms (e.g., /Applications) and provides launching capabilities.

use crate::platform::traits::TerminalInfo;
use std::collections::HashSet;
use std::path::Path;

/// macOS terminal application paths
/// Format: (app_path, display_name, command_identifier, exec_template)
/// The exec_template uses {path} as placeholder for the project path
const MACOS_TERMINALS: &[(&str, &str, &str, &str)] = &[
    // Terminal.app - Always available on macOS
    (
        "/System/Applications/Utilities/Terminal.app",
        "Terminal",
        "terminal",
        "open -a Terminal {path}",
    ),
    // iTerm2
    (
        "/Applications/iTerm.app",
        "iTerm2",
        "iterm2",
        "open -a iTerm {path}",
    ),
    // Warp
    (
        "/Applications/Warp.app",
        "Warp",
        "warp",
        "open -a Warp {path}",
    ),
    // Alacritty
    (
        "/Applications/Alacritty.app",
        "Alacritty",
        "alacritty",
        "open -a Alacritty --args --working-directory {path}",
    ),
    // Kitty
    (
        "/Applications/kitty.app",
        "Kitty",
        "kitty",
        "open -a kitty --args -d {path}",
    ),
    // Hyper
    (
        "/Applications/Hyper.app",
        "Hyper",
        "hyper",
        "open -a Hyper {path}",
    ),
    // WezTerm
    (
        "/Applications/WezTerm.app",
        "WezTerm",
        "wezterm",
        "wezterm start --cwd {path}",
    ),
    // Rio
    (
        "/Applications/Rio.app",
        "Rio",
        "rio",
        "open -a Rio {path}",
    ),
    // Tabby
    (
        "/Applications/Tabby.app",
        "Tabby",
        "tabby",
        "open -a Tabby {path}",
    ),
];

/// Detect terminals installed in /Applications and system locations
pub fn detect_macos_terminals(detected_commands: &HashSet<String>) -> Vec<TerminalInfo> {
    let mut terminals = Vec::new();

    for (path, name, cmd, exec_template) in MACOS_TERMINALS {
        if Path::new(path).exists() && !detected_commands.contains(*cmd) {
            terminals.push(TerminalInfo {
                name: name.to_string(),
                command: cmd.to_string(),
                exec_template: exec_template.to_string(),
            });
        }
    }

    terminals
}
