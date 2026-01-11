use crate::db::models::{GitStatusCache, ScopeGitConfig};
use crate::db::Database;
use crate::services::git_url::{build_ssh_url_with_alias, parse_git_url};
use chrono::Utc;
use git2::{Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, serde::Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub has_uncommitted: bool,
    pub has_untracked: bool,
    pub remote_url: Option<String>,
}

#[tauri::command]
pub fn get_git_status(project_path: String) -> Result<GitStatus, String> {
    let path = Path::new(&project_path);
    let repo = Repository::open(path).map_err(|e| e.to_string())?;

    let branch = get_current_branch(&repo);
    let (ahead, behind) = get_ahead_behind(&repo).unwrap_or((0, 0));
    let (has_uncommitted, has_untracked) = get_status_flags(&repo);
    let remote_url = get_remote_url(&repo);

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        has_uncommitted,
        has_untracked,
        remote_url,
    })
}

#[tauri::command]
pub fn refresh_git_status(db: State<Database>, project_id: String, project_path: String) -> Result<GitStatusCache, String> {
    let status = get_git_status(project_path)?;
    let now = Utc::now();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        INSERT OR REPLACE INTO git_status_cache
        (project_id, branch, ahead, behind, has_uncommitted, has_untracked, last_checked_at, remote_url)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        (
            &project_id,
            &status.branch,
            status.ahead,
            status.behind,
            status.has_uncommitted as i32,
            status.has_untracked as i32,
            now.to_rfc3339(),
            &status.remote_url,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(GitStatusCache {
        project_id,
        branch: status.branch,
        ahead: status.ahead,
        behind: status.behind,
        has_uncommitted: status.has_uncommitted,
        has_untracked: status.has_untracked,
        last_checked_at: Some(now),
        remote_url: status.remote_url,
    })
}

#[tauri::command]
pub fn git_pull(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["pull"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn git_push(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn get_current_branch(repo: &Repository) -> Option<String> {
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
}

fn get_ahead_behind(repo: &Repository) -> Option<(i32, i32)> {
    let head = repo.head().ok()?;
    let local_oid = head.target()?;

    let branch_name = head.shorthand()?;
    let upstream_name = format!("origin/{}", branch_name);

    let upstream_ref = repo.find_reference(&format!("refs/remotes/{}", upstream_name)).ok()?;
    let upstream_oid = upstream_ref.target()?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid).ok()?;

    Some((ahead as i32, behind as i32))
}

fn get_status_flags(repo: &Repository) -> (bool, bool) {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(false);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(_) => return (false, false),
    };

    let mut has_uncommitted = false;
    let mut has_untracked = false;

    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_wt_new() {
            has_untracked = true;
        }
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_wt_modified()
            || status.is_wt_deleted()
        {
            has_uncommitted = true;
        }
    }

    (has_uncommitted, has_untracked)
}

fn get_remote_url(repo: &Repository) -> Option<String> {
    repo.find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(|s| s.to_string()))
}

// Clone repository types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneOptions {
    pub use_ssh_alias: Option<String>,
    pub branch: Option<String>,
    pub shallow: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneProgress {
    pub line: String,
    pub is_error: bool,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    pub success: bool,
    pub project_id: Option<String>,
    pub project_path: Option<String>,
    pub error: Option<String>,
}

/// Check if a folder exists in a scope's default folder
#[tauri::command]
pub fn check_folder_exists(
    db: State<'_, Database>,
    scope_id: String,
    folder_name: String,
) -> Result<bool, String> {
    let default_folder: String = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let folder: Option<String> = conn
            .query_row(
                "SELECT default_folder FROM scopes WHERE id = ?1",
                [&scope_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Scope not found: {}", e))?;
        folder.ok_or("Scope has no default folder configured")?
    };

    let target_path = Path::new(&default_folder).join(&folder_name);
    Ok(target_path.exists())
}

/// Clone a git repository to a scope's default folder
#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    db: State<'_, Database>,
    scope_id: String,
    url: String,
    folder_name: String,
    options: CloneOptions,
) -> Result<CloneResult, String> {
    // Validate scope has a default folder
    let default_folder: String = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let folder: Option<String> = conn
            .query_row(
                "SELECT default_folder FROM scopes WHERE id = ?1",
                [&scope_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Scope not found: {}", e))?;
        folder.ok_or("Scope has no default folder configured")?
    };

    // Build target path
    let target_path = Path::new(&default_folder).join(&folder_name);
    let target_path_str = target_path.to_string_lossy().to_string();

    // Check if folder already exists
    if target_path.exists() {
        return Ok(CloneResult {
            success: false,
            project_id: None,
            project_path: None,
            error: Some(format!("Folder already exists: {}", target_path_str)),
        });
    }

    // Determine final URL (possibly transformed with SSH alias)
    let final_url = if let Some(ref alias) = options.use_ssh_alias {
        // Parse the URL and rebuild with alias
        let known_aliases = get_known_ssh_aliases();
        match parse_git_url(&url, known_aliases) {
            Ok(parsed) => build_ssh_url_with_alias(&parsed, alias),
            Err(_) => url.clone(),
        }
    } else {
        url.clone()
    };

    // Build git clone command
    let mut args = vec!["clone", "--progress"];

    if options.shallow {
        args.push("--depth");
        args.push("1");
    }

    if let Some(ref branch) = options.branch {
        args.push("--branch");
        args.push(branch);
    }

    args.push(&final_url);
    args.push(&target_path_str);

    // Emit initial status
    let _ = app.emit(
        "clone-progress",
        CloneProgress {
            line: format!("Cloning {} into {}", folder_name, default_folder),
            is_error: false,
            status: Some("Initializing...".to_string()),
        },
    );

    // Execute git clone with progress output
    let mut child = Command::new("git")
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start git clone: {}", e))?;

    // Read stderr (git clone outputs progress to stderr)
    let stderr = child.stderr.take();
    if let Some(stderr) = stderr {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            // Parse git progress messages
            let status = parse_git_progress(&line);
            let _ = app.emit(
                "clone-progress",
                CloneProgress {
                    line: line.clone(),
                    is_error: false,
                    status,
                },
            );
        }
    }

    // Wait for completion
    let status = child.wait().map_err(|e| e.to_string())?;

    if !status.success() {
        // Clean up partial clone if exists
        let _ = std::fs::remove_dir_all(&target_path);

        return Ok(CloneResult {
            success: false,
            project_id: None,
            project_path: None,
            error: Some("Git clone failed".to_string()),
        });
    }

    // Clone successful - emit status
    let _ = app.emit(
        "clone-progress",
        CloneProgress {
            line: "Clone completed successfully".to_string(),
            is_error: false,
            status: Some("Registering project...".to_string()),
        },
    );

    // Create project in database
    let project_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO projects (id, scope_id, name, path, is_temp, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
            "#,
            (
                &project_id,
                &scope_id,
                &folder_name,
                &target_path_str,
                now.to_rfc3339(),
                now.to_rfc3339(),
            ),
        )
        .map_err(|e| format!("Failed to create project: {}", e))?;
    }

    // Apply git identity if max_git_integration is enabled
    if let Some(git_config) = get_scope_git_config(&db, &scope_id)? {
        let _ = app.emit(
            "clone-progress",
            CloneProgress {
                line: "Setting up git identity...".to_string(),
                is_error: false,
                status: Some("Configuring git identity...".to_string()),
            },
        );

        apply_git_config_to_project(&target_path_str, &git_config)?;
    }

    let _ = app.emit(
        "clone-progress",
        CloneProgress {
            line: "Done!".to_string(),
            is_error: false,
            status: Some("Complete".to_string()),
        },
    );

    Ok(CloneResult {
        success: true,
        project_id: Some(project_id),
        project_path: Some(target_path_str),
        error: None,
    })
}

/// Parse git clone progress output to extract status
fn parse_git_progress(line: &str) -> Option<String> {
    if line.contains("Cloning into") {
        return Some("Cloning...".to_string());
    }
    if line.contains("Receiving objects") {
        // Extract percentage if present
        if let Some(pct) = extract_percentage(line) {
            return Some(format!("Receiving objects ({}%)", pct));
        }
        return Some("Receiving objects...".to_string());
    }
    if line.contains("Resolving deltas") {
        if let Some(pct) = extract_percentage(line) {
            return Some(format!("Resolving deltas ({}%)", pct));
        }
        return Some("Resolving deltas...".to_string());
    }
    if line.contains("Checking out files") {
        if let Some(pct) = extract_percentage(line) {
            return Some(format!("Checking out files ({}%)", pct));
        }
        return Some("Checking out files...".to_string());
    }
    if line.contains("Updating files") {
        return Some("Updating files...".to_string());
    }
    None
}

/// Extract percentage from git progress output
fn extract_percentage(line: &str) -> Option<u8> {
    // Look for patterns like "50%" or "(50%)"
    let re = regex::Regex::new(r"(\d{1,3})%").ok()?;
    re.captures(line)
        .and_then(|caps| caps.get(1))
        .and_then(|m| m.as_str().parse().ok())
}

/// Get known SSH aliases from config
fn get_known_ssh_aliases() -> Vec<String> {
    // Read from ~/.ssh/config
    match crate::services::ssh_config::read_ssh_aliases() {
        Ok(aliases) => aliases.into_iter().map(|a| a.host).collect(),
        Err(_) => vec![],
    }
}

/// Get scope's git config from cache
fn get_scope_git_config(db: &State<Database>, scope_id: &str) -> Result<Option<ScopeGitConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let config: Result<ScopeGitConfig, _> = conn.query_row(
        r#"
        SELECT scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, raw_gpg_config, config_file_path, last_checked_at
        FROM scope_git_config
        WHERE scope_id = ?1
        "#,
        [scope_id],
        |row| {
            Ok(ScopeGitConfig {
                scope_id: row.get(0)?,
                user_name: row.get(1)?,
                user_email: row.get(2)?,
                gpg_sign: row.get::<_, i32>(3)? != 0,
                gpg_signing_method: row.get(4)?,
                signing_key: row.get(5)?,
                raw_gpg_config: row.get(6)?,
                config_file_path: row.get(7)?,
                last_checked_at: row
                    .get::<_, Option<String>>(8)?
                    .and_then(|s| s.parse().ok()),
            })
        },
    );

    Ok(config.ok())
}

/// Apply git config to a project directory
fn apply_git_config_to_project(project_path: &str, config: &ScopeGitConfig) -> Result<(), String> {
    // Set user.name
    if let Some(ref name) = config.user_name {
        Command::new("git")
            .args(["config", "--local", "user.name", name])
            .current_dir(project_path)
            .output()
            .map_err(|e| e.to_string())?;
    }

    // Set user.email
    if let Some(ref email) = config.user_email {
        Command::new("git")
            .args(["config", "--local", "user.email", email])
            .current_dir(project_path)
            .output()
            .map_err(|e| e.to_string())?;
    }

    // Set GPG signing if enabled
    if config.gpg_sign {
        Command::new("git")
            .args(["config", "--local", "commit.gpgsign", "true"])
            .current_dir(project_path)
            .output()
            .map_err(|e| e.to_string())?;

        if let Some(ref key) = config.signing_key {
            Command::new("git")
                .args(["config", "--local", "user.signingkey", key])
                .current_dir(project_path)
                .output()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
