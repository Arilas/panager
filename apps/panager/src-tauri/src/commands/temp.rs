use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;
use chrono::Utc;

use crate::db::Database;
use crate::git::identity::get_scope_git_identity_tuple;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectRequest {
    pub scope_id: String,
    pub name: String,
    pub package_manager: String,
    pub template: String,
    pub options: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectProgress {
    pub line: String,
    pub is_error: bool,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectResult {
    pub success: bool,
    pub project_id: Option<String>,
    pub project_path: Option<String>,
    pub error: Option<String>,
}

fn emit_progress(app: &AppHandle, line: &str, is_error: bool, status: Option<&str>) {
    let progress = TempProjectProgress {
        line: line.to_string(),
        is_error,
        status: status.map(String::from),
    };
    let _ = app.emit("temp-project-progress", progress);
}

fn get_scope_default_folder(db: &Database, scope_id: &str) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let folder: Option<String> = conn
        .query_row(
            "SELECT default_folder FROM scopes WHERE id = ?1",
            [scope_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get scope: {}", e))?;

    folder.ok_or_else(|| "Scope has no default folder configured".to_string())
}

fn get_scope_temp_settings(db: &Database, scope_id: &str) -> Option<serde_json::Value> {
    let conn = db.conn.lock().ok()?;
    let settings: Option<String> = conn
        .query_row(
            "SELECT temp_project_settings FROM scopes WHERE id = ?1",
            [scope_id],
            |row| row.get(0),
        )
        .ok()?;

    settings.and_then(|s| serde_json::from_str(&s).ok())
}


#[tauri::command]
pub async fn create_temp_project(
    app: AppHandle,
    db: State<'_, Database>,
    request: TempProjectRequest,
) -> Result<TempProjectResult, String> {
    // Get the scope's default folder
    let base_path = PathBuf::from(get_scope_default_folder(&db, &request.scope_id)?);

    emit_progress(&app, &format!("Creating project in {}", base_path.display()), false, Some("Initializing"));

    // Ensure base directory exists
    std::fs::create_dir_all(&base_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let project_path = base_path.join(&request.name);

    // Check if directory already exists
    if project_path.exists() {
        return Ok(TempProjectResult {
            success: false,
            project_id: None,
            project_path: None,
            error: Some(format!("Project '{}' already exists", request.name)),
        });
    }

    // Build the command based on package manager and template
    let (cmd, args) = build_create_command(
        &request.package_manager,
        &request.template,
        &request.name,
        &request.options,
    )?;

    emit_progress(&app, &format!("Running: {} {}", cmd, args.join(" ")), false, Some("Creating project"));

    // Execute the command with streaming output
    let mut child = Command::new(&cmd)
        .args(&args)
        .current_dir(&base_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    // Use a channel to collect output from both stdout and stderr concurrently
    let (tx, rx) = mpsc::channel::<(String, bool)>();

    // Spawn thread to read stdout
    let stdout = child.stdout.take();
    let tx_stdout = tx.clone();
    let stdout_handle = thread::spawn(move || {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = tx_stdout.send((line, false));
                }
            }
        }
    });

    // Spawn thread to read stderr
    let stderr = child.stderr.take();
    let tx_stderr = tx;
    let stderr_handle = thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = tx_stderr.send((line, true));
                }
            }
        }
    });

    // Collect stderr lines for error reporting
    let mut stderr_lines: Vec<String> = Vec::new();

    // Receive and emit progress from both streams
    // (tx_stdout and tx_stderr are moved into threads, rx closes when threads finish)
    for (line, is_error) in rx {
        if is_error {
            stderr_lines.push(line.clone());
        }
        emit_progress(&app, &line, is_error, None);
    }

    // Wait for reader threads to finish
    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    let status = child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;

    if !status.success() {
        // Use the last few stderr lines as the error message
        let error_msg = if stderr_lines.is_empty() {
            format!("Command failed with exit code: {:?}", status.code())
        } else {
            // Take last 5 lines of stderr for a more useful error message
            let last_lines: Vec<&str> = stderr_lines.iter().rev().take(5).map(|s| s.as_str()).collect();
            last_lines.into_iter().rev().collect::<Vec<_>>().join("\n")
        };
        return Ok(TempProjectResult {
            success: false,
            project_id: None,
            project_path: None,
            error: Some(error_msg),
        });
    }

    emit_progress(&app, "Project created successfully", false, Some("Project created"));

    // Check if we need to setup git identity
    let temp_settings = get_scope_temp_settings(&db, &request.scope_id);
    let should_setup_git = temp_settings
        .as_ref()
        .and_then(|s| s.get("setupGitIdentity"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if should_setup_git {
        emit_progress(&app, "Setting up git identity...", false, Some("Configuring git"));

        // Check if .git exists
        let git_dir = project_path.join(".git");
        if !git_dir.exists() {
            // Initialize git
            emit_progress(&app, "Initializing git repository...", false, None);
            let git_init = Command::new("git")
                .args(["init"])
                .current_dir(&project_path)
                .output();

            match git_init {
                Ok(output) if output.status.success() => {
                    emit_progress(&app, "Git repository initialized", false, None);
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    emit_progress(&app, &format!("Warning: git init failed: {}", stderr), true, None);
                }
                Err(e) => {
                    emit_progress(&app, &format!("Warning: git init failed: {}", e), true, None);
                }
            }
        }

        // Apply scope's git identity using git config commands
        if let Some((user_name, user_email)) = get_scope_git_identity_tuple(&db, &request.scope_id) {
            // Set user.name
            let name_result = Command::new("git")
                .args(["config", "user.name", &user_name])
                .current_dir(&project_path)
                .output();

            match name_result {
                Ok(output) if output.status.success() => {
                    emit_progress(&app, &format!("Set git user.name: {}", user_name), false, None);
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    emit_progress(&app, &format!("Warning: Failed to set user.name: {}", stderr), true, None);
                }
                Err(e) => {
                    emit_progress(&app, &format!("Warning: Failed to set user.name: {}", e), true, None);
                }
            }

            // Set user.email
            let email_result = Command::new("git")
                .args(["config", "user.email", &user_email])
                .current_dir(&project_path)
                .output();

            match email_result {
                Ok(output) if output.status.success() => {
                    emit_progress(&app, &format!("Set git user.email: {}", user_email), false, None);
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    emit_progress(&app, &format!("Warning: Failed to set user.email: {}", stderr), true, None);
                }
                Err(e) => {
                    emit_progress(&app, &format!("Warning: Failed to set user.email: {}", e), true, None);
                }
            }

            emit_progress(&app, "Git identity configured", false, None);
        } else {
            emit_progress(&app, "No git identity found for this scope", true, None);
        }
    }

    // Create the project entry in the database
    let project_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let project_path_str = project_path.to_string_lossy().to_string();

    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO projects (id, scope_id, name, path, is_temp, created_at, updated_at, last_opened_at)
            VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7)
            "#,
            (
                &project_id,
                &request.scope_id,
                &request.name,
                &project_path_str,
                now.to_rfc3339(),
                now.to_rfc3339(),
                now.to_rfc3339(),
            ),
        )
        .map_err(|e| format!("Failed to create project entry: {}", e))?;
    }

    emit_progress(&app, "Done!", false, Some("Complete"));

    Ok(TempProjectResult {
        success: true,
        project_id: Some(project_id),
        project_path: Some(project_path_str),
        error: None,
    })
}

fn build_create_command(
    package_manager: &str,
    template: &str,
    name: &str,
    options: &Option<serde_json::Value>,
) -> Result<(String, Vec<String>), String> {
    match template {
        // Vite templates
        "vite-react" => Ok(build_vite_command(package_manager, name, "react")),
        "vite-react-ts" => Ok(build_vite_command(package_manager, name, "react-ts")),
        "vite-vue" => Ok(build_vite_command(package_manager, name, "vue")),
        "vite-vue-ts" => Ok(build_vite_command(package_manager, name, "vue-ts")),
        "vite-svelte" => Ok(build_vite_command(package_manager, name, "svelte")),
        "vite-svelte-ts" => Ok(build_vite_command(package_manager, name, "svelte-ts")),
        "vite-vanilla" => Ok(build_vite_command(package_manager, name, "vanilla")),
        "vite-vanilla-ts" => Ok(build_vite_command(package_manager, name, "vanilla-ts")),

        // Frameworks
        "nextjs" => Ok(build_nextjs_command(package_manager, name, options)),
        "remix" => Ok(build_remix_command(package_manager, name, options)),
        "astro" => Ok(build_astro_command(package_manager, name, options)),
        "nuxt" => Ok(build_nuxt_command(package_manager, name)),
        "sveltekit" => Ok(build_sveltekit_command(package_manager, name, options)),
        "solid" => Ok(build_solid_command(package_manager, name, options)),

        // Backend
        "nest" => Ok(build_nest_command(package_manager, name, options)),
        "hono" => Ok(build_hono_command(package_manager, name)),

        _ => Err(format!("Unknown template: {}", template)),
    }
}

fn build_vite_command(package_manager: &str, name: &str, template: &str) -> (String, Vec<String>) {
    match package_manager {
        "npm" => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "vite@latest".to_string(),
                name.to_string(),
                "--".to_string(),
                "--template".to_string(),
                template.to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "create".to_string(),
                "vite".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "create".to_string(),
                "vite".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
            ],
        ),
        "bun" => (
            "bun".to_string(),
            vec![
                "create".to_string(),
                "vite".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
            ],
        ),
        _ => build_vite_command("npm", name, template),
    }
}

fn build_nextjs_command(package_manager: &str, name: &str, options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    let opts = options.as_ref().and_then(|o| o.get("nextjs"));

    let typescript = opts.and_then(|o| o.get("typescript")).and_then(|v| v.as_bool()).unwrap_or(true);
    let tailwind = opts.and_then(|o| o.get("tailwind")).and_then(|v| v.as_bool()).unwrap_or(true);
    let eslint = opts.and_then(|o| o.get("eslint")).and_then(|v| v.as_bool()).unwrap_or(true);
    let router = opts.and_then(|o| o.get("router")).and_then(|v| v.as_str()).unwrap_or("app");
    let src_dir = opts.and_then(|o| o.get("srcDir")).and_then(|v| v.as_bool()).unwrap_or(true);

    let mut args = vec!["create-next-app@latest".to_string(), name.to_string()];

    if typescript {
        args.push("--ts".to_string());
    } else {
        args.push("--js".to_string());
    }

    if tailwind {
        args.push("--tailwind".to_string());
    } else {
        args.push("--no-tailwind".to_string());
    }

    if eslint {
        args.push("--eslint".to_string());
    } else {
        args.push("--no-eslint".to_string());
    }

    if router == "app" {
        args.push("--app".to_string());
    } else {
        args.push("--no-app".to_string());
    }

    if src_dir {
        args.push("--src-dir".to_string());
    } else {
        args.push("--no-src-dir".to_string());
    }

    args.push("--no-import-alias".to_string());

    // Skip interactive prompts (React Compiler, etc.)
    args.push("--skip-install".to_string());
    args.push("--yes".to_string());

    let cmd = match package_manager {
        "npm" => "npx".to_string(),
        "yarn" => {
            args[0] = "next-app".to_string();
            args.insert(0, "create".to_string());
            "yarn".to_string()
        }
        "pnpm" => {
            args[0] = "next-app".to_string();
            args.insert(0, "create".to_string());
            "pnpm".to_string()
        }
        "bun" => "bunx".to_string(),
        _ => "npx".to_string(),
    };

    (cmd, args)
}

fn build_remix_command(package_manager: &str, name: &str, options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    let opts = options.as_ref().and_then(|o| o.get("remix"));
    let typescript = opts.and_then(|o| o.get("typescript")).and_then(|v| v.as_bool()).unwrap_or(true);

    let mut args = vec!["create-remix@latest".to_string(), name.to_string(), "--yes".to_string()];

    if !typescript {
        args.push("--no-typescript".to_string());
    }

    let cmd = match package_manager {
        "npm" => "npx".to_string(),
        "yarn" => "yarn".to_string(),
        "pnpm" => {
            args[0] = "create-remix@latest".to_string();
            args.insert(0, "dlx".to_string());
            "pnpm".to_string()
        }
        "bun" => "bunx".to_string(),
        _ => "npx".to_string(),
    };

    (cmd, args)
}

fn build_astro_command(package_manager: &str, name: &str, options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    let opts = options.as_ref().and_then(|o| o.get("astro"));
    let template = opts.and_then(|o| o.get("template")).and_then(|v| v.as_str()).unwrap_or("basics");
    let typescript = opts.and_then(|o| o.get("typescript")).and_then(|v| v.as_str()).unwrap_or("strict");

    match package_manager {
        "npm" => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "astro@latest".to_string(),
                "--".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
                "--typescript".to_string(),
                typescript.to_string(),
                "--no-install".to_string(),
                "--no-git".to_string(),
                "-y".to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "create".to_string(),
                "astro".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
                "--typescript".to_string(),
                typescript.to_string(),
                "--no-install".to_string(),
                "--no-git".to_string(),
                "-y".to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "create".to_string(),
                "astro@latest".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
                "--typescript".to_string(),
                typescript.to_string(),
                "--no-install".to_string(),
                "--no-git".to_string(),
                "-y".to_string(),
            ],
        ),
        "bun" => (
            "bunx".to_string(),
            vec![
                "create-astro@latest".to_string(),
                name.to_string(),
                "--template".to_string(),
                template.to_string(),
                "--typescript".to_string(),
                typescript.to_string(),
                "--no-install".to_string(),
                "--no-git".to_string(),
                "-y".to_string(),
            ],
        ),
        _ => build_astro_command("npm", name, options),
    }
}

fn build_nuxt_command(package_manager: &str, name: &str) -> (String, Vec<String>) {
    match package_manager {
        "npm" => (
            "npx".to_string(),
            vec!["nuxi@latest".to_string(), "init".to_string(), name.to_string()],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "dlx".to_string(),
                "nuxi@latest".to_string(),
                "init".to_string(),
                name.to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "dlx".to_string(),
                "nuxi@latest".to_string(),
                "init".to_string(),
                name.to_string(),
            ],
        ),
        "bun" => (
            "bunx".to_string(),
            vec!["nuxi@latest".to_string(), "init".to_string(), name.to_string()],
        ),
        _ => build_nuxt_command("npm", name),
    }
}

fn build_sveltekit_command(package_manager: &str, name: &str, _options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    // Note: create-svelte is interactive, so we use minimal options
    match package_manager {
        "npm" => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "svelte@latest".to_string(),
                name.to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "create".to_string(),
                "svelte@latest".to_string(),
                name.to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "create".to_string(),
                "svelte@latest".to_string(),
                name.to_string(),
            ],
        ),
        "bun" => (
            "bun".to_string(),
            vec![
                "create".to_string(),
                "svelte@latest".to_string(),
                name.to_string(),
            ],
        ),
        _ => build_sveltekit_command("npm", name, _options),
    }
}

fn build_solid_command(package_manager: &str, name: &str, options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    let opts = options.as_ref().and_then(|o| o.get("solid"));
    let ssr = opts.and_then(|o| o.get("ssr")).and_then(|v| v.as_bool()).unwrap_or(false);

    let template = if ssr { "solid-start" } else { "ts" };

    match package_manager {
        "npm" => (
            "npx".to_string(),
            vec![
                "degit".to_string(),
                format!("solidjs/templates/{}", template),
                name.to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "dlx".to_string(),
                "degit".to_string(),
                format!("solidjs/templates/{}", template),
                name.to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "dlx".to_string(),
                "degit".to_string(),
                format!("solidjs/templates/{}", template),
                name.to_string(),
            ],
        ),
        "bun" => (
            "bunx".to_string(),
            vec![
                "degit".to_string(),
                format!("solidjs/templates/{}", template),
                name.to_string(),
            ],
        ),
        _ => build_solid_command("npm", name, options),
    }
}

fn build_nest_command(package_manager: &str, name: &str, options: &Option<serde_json::Value>) -> (String, Vec<String>) {
    let opts = options.as_ref().and_then(|o| o.get("nest"));
    let strict = opts.and_then(|o| o.get("strict")).and_then(|v| v.as_bool()).unwrap_or(true);

    let pm_flag = match package_manager {
        "yarn" => "--package-manager=yarn",
        "pnpm" => "--package-manager=pnpm",
        "bun" => "--package-manager=npm", // NestJS doesn't support bun directly
        _ => "--package-manager=npm",
    };

    let mut args = vec![
        "@nestjs/cli".to_string(),
        "new".to_string(),
        name.to_string(),
        pm_flag.to_string(),
        "--skip-git".to_string(),
    ];

    if strict {
        args.push("--strict".to_string());
    }

    let cmd = match package_manager {
        "npm" => "npx".to_string(),
        "yarn" => {
            args.insert(0, "dlx".to_string());
            "yarn".to_string()
        }
        "pnpm" => {
            args.insert(0, "dlx".to_string());
            "pnpm".to_string()
        }
        "bun" => "bunx".to_string(),
        _ => "npx".to_string(),
    };

    (cmd, args)
}

fn build_hono_command(package_manager: &str, name: &str) -> (String, Vec<String>) {
    match package_manager {
        "npm" => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "hono@latest".to_string(),
                name.to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "create".to_string(),
                "hono".to_string(),
                name.to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "create".to_string(),
                "hono@latest".to_string(),
                name.to_string(),
            ],
        ),
        "bun" => (
            "bun".to_string(),
            vec![
                "create".to_string(),
                "hono".to_string(),
                name.to_string(),
            ],
        ),
        _ => build_hono_command("npm", name),
    }
}
