use std::process::Command;

#[tauri::command]
#[specta::specta]
pub fn open_terminal(project_path: String) -> Result<(), String> {
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
        // Try common terminals
        let terminals = ["gnome-terminal", "xterm", "konsole", "alacritty"];
        let mut opened = false;
        
        for term in &terminals {
            if let Ok(mut child) = Command::new(term)
                .arg("--working-directory")
                .arg(&project_path)
                .spawn()
            {
                // Don't wait for the process
                let _ = child.wait();
                opened = true;
                break;
            }
        }
        
        if !opened {
            return Err("No terminal found. Please install gnome-terminal, xterm, konsole, or alacritty".to_string());
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return Err("Terminal opening not supported on this platform".to_string());
    }

    Ok(())
}
