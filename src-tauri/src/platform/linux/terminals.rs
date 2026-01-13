//! Linux-specific terminal detection
//!
//! This module handles detection of terminal emulators installed on Linux
//! via PATH, Flatpak, and Snap.

use crate::platform::traits::TerminalInfo;
use std::collections::HashSet;
use which::which;

/// Known Linux terminal emulators
/// Format: (command, display_name, exec_template)
/// The exec_template uses {path} as placeholder for the project path
const LINUX_TERMINALS: &[(&str, &str, &str)] = &[
    // GNOME Terminal
    (
        "gnome-terminal",
        "GNOME Terminal",
        "gnome-terminal --working-directory={path}",
    ),
    // Konsole (KDE)
    ("konsole", "Konsole", "konsole --workdir {path}"),
    // Alacritty
    (
        "alacritty",
        "Alacritty",
        "alacritty --working-directory {path}",
    ),
    // Kitty
    ("kitty", "Kitty", "kitty -d {path}"),
    // WezTerm
    ("wezterm", "WezTerm", "wezterm start --cwd {path}"),
    // Tilix
    ("tilix", "Tilix", "tilix --working-directory={path}"),
    // Terminator
    (
        "terminator",
        "Terminator",
        "terminator --working-directory={path}",
    ),
    // xfce4-terminal
    (
        "xfce4-terminal",
        "XFCE Terminal",
        "xfce4-terminal --working-directory={path}",
    ),
    // mate-terminal
    (
        "mate-terminal",
        "MATE Terminal",
        "mate-terminal --working-directory={path}",
    ),
    // xterm (basic, no working directory flag)
    ("xterm", "XTerm", "xterm -e 'cd {path} && $SHELL'"),
    // Foot (Wayland)
    ("foot", "Foot", "foot --working-directory={path}"),
    // Rio
    ("rio", "Rio", "rio {path}"),
];

/// Flatpak terminal apps
/// Format: (app_id, display_name, command_identifier, exec_template)
const FLATPAK_TERMINALS: &[(&str, &str, &str, &str)] = &[
    (
        "org.gnome.Terminal",
        "GNOME Terminal (Flatpak)",
        "flatpak-gnome-terminal",
        "flatpak run org.gnome.Terminal --working-directory={path}",
    ),
    (
        "org.kde.konsole",
        "Konsole (Flatpak)",
        "flatpak-konsole",
        "flatpak run org.kde.konsole --workdir {path}",
    ),
    (
        "io.github.AlacrittyCommunity.Alacritty",
        "Alacritty (Flatpak)",
        "flatpak-alacritty",
        "flatpak run io.github.AlacrittyCommunity.Alacritty --working-directory {path}",
    ),
    (
        "org.wezfurlong.wezterm",
        "WezTerm (Flatpak)",
        "flatpak-wezterm",
        "flatpak run org.wezfurlong.wezterm start --cwd {path}",
    ),
];

/// Detect terminals available in PATH
pub fn detect_linux_terminals(detected_commands: &HashSet<String>) -> Vec<TerminalInfo> {
    let mut terminals = Vec::new();

    // PATH-based detection
    for (cmd, name, exec_template) in LINUX_TERMINALS {
        if which(cmd).is_ok() && !detected_commands.contains(*cmd) {
            terminals.push(TerminalInfo {
                name: name.to_string(),
                command: cmd.to_string(),
                exec_template: exec_template.to_string(),
            });
        }
    }

    // Flatpak detection
    for (app_id, name, cmd, exec_template) in FLATPAK_TERMINALS {
        if !detected_commands.contains(*cmd) && is_flatpak_installed(app_id) {
            terminals.push(TerminalInfo {
                name: name.to_string(),
                command: cmd.to_string(),
                exec_template: exec_template.to_string(),
            });
        }
    }

    terminals
}

/// Check if a Flatpak app is installed
fn is_flatpak_installed(app_id: &str) -> bool {
    std::process::Command::new("flatpak")
        .args(["info", app_id])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
