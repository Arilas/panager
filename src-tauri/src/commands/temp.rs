use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

use crate::db::Database;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectRequest {
    pub name: String,
    pub package_manager: String,
    pub template: String,
    pub base_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempProjectResult {
    pub path: String,
    pub success: bool,
    pub message: String,
}

fn get_temp_base_path(db: &Database, custom_path: Option<String>) -> PathBuf {
    if let Some(path) = custom_path {
        if !path.is_empty() {
            return PathBuf::from(path);
        }
    }

    // Try to get from settings
    if let Ok(conn) = db.conn.lock() {
        let value: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'temp_project_path'",
                [],
                |row| row.get(0),
            )
            .ok();

        if let Some(v) = value {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&v) {
                if let Some(path) = parsed.as_str() {
                    if !path.is_empty() {
                        return PathBuf::from(path);
                    }
                }
            }
        }
    }

    // Default to system temp directory
    let mut temp_dir = std::env::temp_dir();
    temp_dir.push("panager-temp-projects");
    temp_dir
}

#[tauri::command]
pub async fn create_temp_project(
    db: State<'_, Database>,
    request: TempProjectRequest,
) -> Result<TempProjectResult, String> {
    let base_path = get_temp_base_path(&db, request.base_path);

    // Ensure base directory exists
    std::fs::create_dir_all(&base_path)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let project_path = base_path.join(&request.name);

    // Check if directory already exists
    if project_path.exists() {
        return Err(format!("Project '{}' already exists", request.name));
    }

    // Build the command based on package manager and template
    let (cmd, args) = build_create_command(
        &request.package_manager,
        &request.template,
        &request.name,
        &base_path,
    )?;

    // Execute the command
    let output = Command::new(&cmd)
        .args(&args)
        .current_dir(&base_path)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        Ok(TempProjectResult {
            path: project_path.to_string_lossy().to_string(),
            success: true,
            message: "Project created successfully".to_string(),
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to create project: {}", stderr))
    }
}

fn build_create_command(
    package_manager: &str,
    template: &str,
    name: &str,
    _base_path: &PathBuf,
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

        // Next.js
        "nextjs" => Ok(build_nextjs_command(package_manager, name)),

        // Astro
        "astro" => Ok(build_astro_command(package_manager, name)),

        // Nuxt
        "nuxt" => Ok(build_nuxt_command(package_manager, name)),

        // SvelteKit
        "sveltekit" => Ok(build_sveltekit_command(package_manager, name)),

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
        _ => (
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
    }
}

fn build_nextjs_command(package_manager: &str, name: &str) -> (String, Vec<String>) {
    match package_manager {
        "npm" => (
            "npx".to_string(),
            vec![
                "create-next-app@latest".to_string(),
                name.to_string(),
                "--typescript".to_string(),
                "--tailwind".to_string(),
                "--eslint".to_string(),
                "--app".to_string(),
                "--src-dir".to_string(),
                "--no-import-alias".to_string(),
            ],
        ),
        "yarn" => (
            "yarn".to_string(),
            vec![
                "create".to_string(),
                "next-app".to_string(),
                name.to_string(),
                "--typescript".to_string(),
                "--tailwind".to_string(),
                "--eslint".to_string(),
                "--app".to_string(),
                "--src-dir".to_string(),
                "--no-import-alias".to_string(),
            ],
        ),
        "pnpm" => (
            "pnpm".to_string(),
            vec![
                "create".to_string(),
                "next-app".to_string(),
                name.to_string(),
                "--typescript".to_string(),
                "--tailwind".to_string(),
                "--eslint".to_string(),
                "--app".to_string(),
                "--src-dir".to_string(),
                "--no-import-alias".to_string(),
            ],
        ),
        "bun" => (
            "bunx".to_string(),
            vec![
                "create-next-app@latest".to_string(),
                name.to_string(),
                "--typescript".to_string(),
                "--tailwind".to_string(),
                "--eslint".to_string(),
                "--app".to_string(),
                "--src-dir".to_string(),
                "--no-import-alias".to_string(),
            ],
        ),
        _ => (
            "npx".to_string(),
            vec![
                "create-next-app@latest".to_string(),
                name.to_string(),
                "--typescript".to_string(),
            ],
        ),
    }
}

fn build_astro_command(package_manager: &str, name: &str) -> (String, Vec<String>) {
    match package_manager {
        "npm" => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "astro@latest".to_string(),
                "--".to_string(),
                name.to_string(),
                "--template".to_string(),
                "basics".to_string(),
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
                "basics".to_string(),
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
                "basics".to_string(),
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
                "basics".to_string(),
                "--no-install".to_string(),
                "--no-git".to_string(),
                "-y".to_string(),
            ],
        ),
        _ => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "astro@latest".to_string(),
                "--".to_string(),
                name.to_string(),
            ],
        ),
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
        _ => (
            "npx".to_string(),
            vec!["nuxi@latest".to_string(), "init".to_string(), name.to_string()],
        ),
    }
}

fn build_sveltekit_command(package_manager: &str, name: &str) -> (String, Vec<String>) {
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
        _ => (
            "npm".to_string(),
            vec![
                "create".to_string(),
                "svelte@latest".to_string(),
                name.to_string(),
            ],
        ),
    }
}

#[tauri::command]
pub fn get_temp_projects_path(db: State<'_, Database>) -> String {
    get_temp_base_path(&db, None).to_string_lossy().to_string()
}
