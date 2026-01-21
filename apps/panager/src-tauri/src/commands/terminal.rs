//! Terminal opening command
//!
//! This module provides a Tauri command for opening a terminal at a specific path.

use std::process::Command;

/// Open a terminal at the specified project path
///
/// If exec_template is provided, it will be used to launch the terminal.
/// The template should contain {path} as a placeholder for the project path.
/// If not provided, falls back to platform defaults.
#[tauri::command]
#[specta::specta]
pub fn open_terminal(project_path: String, exec_template: Option<String>) -> Result<(), String> {
    // If we have an exec_template, use it
    if let Some(template) = exec_template {
        return execute_template(&template, &project_path);
    }

    // Fall back to platform defaults
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", &project_path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/K", "cd", "/d", &project_path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminals in order of preference
        let terminals = [
            ("gnome-terminal", "--working-directory"),
            ("konsole", "--workdir"),
            ("alacritty", "--working-directory"),
            ("xterm", "-e"),
        ];

        let opened = terminals.iter().any(|(term, flag)| {
            if which::which(term).is_err() {
                return false;
            }

            let result = if *term == "xterm" {
                Command::new(term)
                    .arg(flag)
                    .arg(format!("cd '{}' && $SHELL", project_path))
                    .spawn()
            } else {
                Command::new(term).arg(flag).arg(&project_path).spawn()
            };

            result.is_ok()
        });

        if !opened {
            return Err(
                "No terminal found. Please install gnome-terminal, konsole, or alacritty"
                    .to_string(),
            );
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return Err("Terminal opening not supported on this platform".to_string());
    }

    Ok(())
}

/// Execute a terminal launch template
fn execute_template(template: &str, project_path: &str) -> Result<(), String> {
    // Replace {path} placeholder with actual path
    let command_str = template.replace("{path}", project_path);

    // Parse the command - first word is the program, rest are arguments
    let parts: Vec<&str> = command_str.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Invalid exec template: empty command".to_string());
    }

    let program = parts[0];

    // Handle special case for macOS `open -a` commands
    #[cfg(target_os = "macos")]
    if program == "open" && parts.len() >= 3 && parts[1] == "-a" {
        // Find where the app name ends
        // Format: open -a AppName [--args ...] path
        let mut cmd = Command::new("open");
        cmd.arg("-a");

        // Find if there are --args
        let args_idx = parts.iter().position(|&p| p == "--args");

        if let Some(idx) = args_idx {
            // App name is between -a and --args
            cmd.arg(parts[2]);
            cmd.arg("--args");
            // Add everything after --args
            for part in &parts[idx + 1..] {
                cmd.arg(*part);
            }
        } else {
            // No --args, everything after -a is app name and path
            for part in &parts[2..] {
                cmd.arg(*part);
            }
        }

        return cmd
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to open terminal: {}", e));
    }

    // Handle Flatpak commands
    #[cfg(target_os = "linux")]
    if program == "flatpak" && parts.len() >= 3 && parts[1] == "run" {
        let mut cmd = Command::new("flatpak");
        cmd.arg("run");
        for part in &parts[2..] {
            cmd.arg(*part);
        }
        return cmd
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to open terminal via Flatpak: {}", e));
    }

    // Default: execute command with arguments
    let mut cmd = Command::new(program);
    for part in &parts[1..] {
        cmd.arg(*part);
    }

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open terminal '{}': {}", program, e))
}
