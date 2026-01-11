use crate::db::models::{GitIncludeIf, ScopeGitConfig};
use crate::db::Database;
use chrono::Utc;
use regex::Regex;
use std::fs;
use std::io::Write;
use std::path::Path;
use tauri::State;

/// Read all includeIf sections from ~/.gitconfig
#[tauri::command]
pub fn read_git_include_ifs() -> Result<Vec<GitIncludeIf>, String> {
    let home = home::home_dir().ok_or("Could not find home directory")?;
    let gitconfig_path = home.join(".gitconfig");

    if !gitconfig_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&gitconfig_path).map_err(|e| e.to_string())?;

    parse_include_ifs(&content)
}

/// Parse includeIf sections from gitconfig content
fn parse_include_ifs(content: &str) -> Result<Vec<GitIncludeIf>, String> {
    let mut result = Vec::new();

    // Match [includeIf "condition"]
    let section_regex =
        Regex::new(r#"\[includeIf\s+"([^"]+)"\]"#).map_err(|e| e.to_string())?;

    // Match path = value
    let path_regex = Regex::new(r#"^\s*path\s*=\s*(.+)$"#).map_err(|e| e.to_string())?;

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        if let Some(caps) = section_regex.captures(lines[i]) {
            let condition = caps.get(1).map(|m| m.as_str()).unwrap_or("").to_string();

            // Look for path in the next lines (until next section or end)
            i += 1;
            while i < lines.len() {
                let line = lines[i].trim();

                // New section starts
                if line.starts_with('[') {
                    break;
                }

                if let Some(path_caps) = path_regex.captures(line) {
                    let path = path_caps
                        .get(1)
                        .map(|m| m.as_str().trim())
                        .unwrap_or("")
                        .to_string();

                    if !path.is_empty() {
                        result.push(GitIncludeIf { condition, path });
                        break;
                    }
                }

                i += 1;
            }
        } else {
            i += 1;
        }
    }

    Ok(result)
}

/// Get git identity for a scope based on its default folder
#[tauri::command]
pub fn get_scope_git_identity(
    db: State<Database>,
    scope_id: String,
) -> Result<Option<ScopeGitConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // First check cache
    let cached: Result<ScopeGitConfig, _> = conn.query_row(
        r#"
        SELECT scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, raw_gpg_config, config_file_path, last_checked_at
        FROM scope_git_config
        WHERE scope_id = ?1
        "#,
        [&scope_id],
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

    if let Ok(config) = cached {
        return Ok(Some(config));
    }

    // Get scope's default folder
    let default_folder: Option<String> = conn
        .query_row(
            "SELECT default_folder FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .ok();

    let default_folder = match default_folder {
        Some(f) if !f.is_empty() => f,
        _ => return Ok(None),
    };

    drop(conn);

    // Helper function to cache and return a config
    let cache_config = |db: &State<Database>, config: ScopeGitConfig| -> Result<Option<ScopeGitConfig>, String> {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT OR REPLACE INTO scope_git_config
            (scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, config_file_path, last_checked_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            (
                &config.scope_id,
                &config.user_name,
                &config.user_email,
                if config.gpg_sign { 1 } else { 0 },
                &config.gpg_signing_method,
                &config.signing_key,
                &config.config_file_path,
                Utc::now().to_rfc3339(),
            ),
        )
        .map_err(|e| e.to_string())?;
        Ok(Some(config))
    };

    // FIRST: Check if there's a .gitconfig file directly in the scope's default folder
    // This catches existing configs that may not have an includeIf entry yet
    let direct_config_path = Path::new(&default_folder).join(".gitconfig");
    if direct_config_path.exists() {
        if let Ok(identity) = read_git_identity_from_file(direct_config_path.to_str().unwrap_or("")) {
            let config = ScopeGitConfig {
                scope_id: scope_id.clone(),
                user_name: identity.0,
                user_email: identity.1,
                gpg_sign: identity.2,
                gpg_signing_method: if identity.2 { Some("manual".to_string()) } else { Some("none".to_string()) },
                signing_key: identity.3,
                raw_gpg_config: None,
                config_file_path: Some(direct_config_path.to_string_lossy().to_string()),
                last_checked_at: Some(Utc::now()),
            };
            return cache_config(&db, config);
        }
    }

    // SECOND: Find matching includeIf in ~/.gitconfig
    let include_ifs = read_git_include_ifs()?;
    // Normalize default_folder by removing trailing slash for consistent comparison
    let normalized_folder = default_folder.trim_end_matches('/');
    let matching = include_ifs.iter().find(|incl| {
        // Check if condition matches the scope folder
        // gitdir conditions end with / and use glob matching
        if incl.condition.starts_with("gitdir:") {
            let pattern = incl.condition.trim_start_matches("gitdir:");
            let pattern = pattern.trim_end_matches("**");
            let pattern = pattern.trim_end_matches('/');
            // Check exact match or that folder is inside the pattern directory
            normalized_folder == pattern || normalized_folder.starts_with(&format!("{}/", pattern))
        } else if incl.condition.starts_with("gitdir/i:") {
            let pattern = incl.condition.trim_start_matches("gitdir/i:");
            let pattern = pattern.trim_end_matches("**");
            let pattern = pattern.trim_end_matches('/');
            let normalized_lower = normalized_folder.to_lowercase();
            let pattern_lower = pattern.to_lowercase();
            normalized_lower == pattern_lower || normalized_lower.starts_with(&format!("{}/", pattern_lower))
        } else {
            false
        }
    });

    if let Some(incl) = matching {
        // Read the included config file
        let config_path = expand_path(&incl.path);
        if let Ok(identity) = read_git_identity_from_file(&config_path) {
            let config = ScopeGitConfig {
                scope_id: scope_id.clone(),
                user_name: identity.0,
                user_email: identity.1,
                gpg_sign: identity.2,
                gpg_signing_method: if identity.2 { Some("manual".to_string()) } else { Some("none".to_string()) },
                signing_key: identity.3,
                raw_gpg_config: None,
                config_file_path: Some(config_path),
                last_checked_at: Some(Utc::now()),
            };
            return cache_config(&db, config);
        }
    }

    Ok(None)
}

/// Read git identity from a config file
/// Returns (name, email, gpg_sign, signing_key)
fn read_git_identity_from_file(path: &str) -> Result<(Option<String>, Option<String>, bool, Option<String>), String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;

    let mut name = None;
    let mut email = None;
    let mut gpg_sign = false;
    let mut signing_key = None;

    let name_regex = Regex::new(r#"^\s*name\s*=\s*(.+)$"#).map_err(|e| e.to_string())?;
    let email_regex = Regex::new(r#"^\s*email\s*=\s*(.+)$"#).map_err(|e| e.to_string())?;
    let gpg_regex = Regex::new(r#"^\s*gpgsign\s*=\s*(true|1)"#).map_err(|e| e.to_string())?;
    let signingkey_regex = Regex::new(r#"^\s*signingkey\s*=\s*(.+)$"#).map_err(|e| e.to_string())?;

    let mut in_user_section = false;
    let mut in_commit_section = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('[') {
            in_user_section = trimmed.to_lowercase().starts_with("[user");
            in_commit_section = trimmed.to_lowercase().starts_with("[commit");
            continue;
        }

        if in_user_section {
            if let Some(caps) = name_regex.captures(trimmed) {
                name = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
            if let Some(caps) = email_regex.captures(trimmed) {
                email = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
            if let Some(caps) = signingkey_regex.captures(trimmed) {
                signing_key = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
        }

        if in_commit_section && gpg_regex.is_match(trimmed) {
            gpg_sign = true;
        }
    }

    Ok((name, email, gpg_sign, signing_key))
}

/// Expand ~ in paths
fn expand_path(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = home::home_dir() {
            return home.join(&path[2..]).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// Verify a project's git config matches the scope's expected config
#[tauri::command]
pub fn verify_project_git_config(
    db: State<Database>,
    project_id: String,
) -> Result<Vec<ConfigMismatch>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get project info
    let (project_path, scope_id): (String, String) = conn
        .query_row(
            "SELECT path, scope_id FROM projects WHERE id = ?1",
            [&project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Get scope's expected git config
    let expected: Option<ScopeGitConfig> = conn
        .query_row(
            r#"
            SELECT scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, raw_gpg_config, config_file_path, last_checked_at
            FROM scope_git_config
            WHERE scope_id = ?1
            "#,
            [&scope_id],
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
        )
        .ok();

    let expected = match expected {
        Some(e) => e,
        None => return Ok(vec![]),
    };

    drop(conn);

    // Read project's local .git/config
    let git_config_path = Path::new(&project_path).join(".git").join("config");
    if !git_config_path.exists() {
        return Ok(vec![]);
    }

    let actual = read_git_identity_from_file(git_config_path.to_str().unwrap_or(""))?;

    let mut mismatches = Vec::new();

    // Check name
    if let Some(ref expected_name) = expected.user_name {
        if actual.0.as_ref() != Some(expected_name) {
            mismatches.push(ConfigMismatch {
                issue_type: "git_name".to_string(),
                expected_value: Some(expected_name.clone()),
                actual_value: actual.0.clone(),
            });
        }
    }

    // Check email
    if let Some(ref expected_email) = expected.user_email {
        if actual.1.as_ref() != Some(expected_email) {
            mismatches.push(ConfigMismatch {
                issue_type: "git_email".to_string(),
                expected_value: Some(expected_email.clone()),
                actual_value: actual.1.clone(),
            });
        }
    }

    // Check GPG signing
    if expected.gpg_sign != actual.2 {
        mismatches.push(ConfigMismatch {
            issue_type: "git_gpg".to_string(),
            expected_value: Some(expected.gpg_sign.to_string()),
            actual_value: Some(actual.2.to_string()),
        });
    }

    Ok(mismatches)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigMismatch {
    pub issue_type: String,
    pub expected_value: Option<String>,
    pub actual_value: Option<String>,
}

/// Fix a project's git config to match the scope's expected config
#[tauri::command]
pub fn fix_project_git_config(
    db: State<Database>,
    project_id: String,
    config_key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let project_path: String = conn
        .query_row("SELECT path FROM projects WHERE id = ?1", [&project_id], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    drop(conn);

    // Use git command to set config
    let output = std::process::Command::new("git")
        .args(["config", "--local", &config_key, &value])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Create a new includeIf section in ~/.gitconfig for a scope
#[tauri::command]
pub fn create_git_include_if(scope_folder: String, config_path: String) -> Result<(), String> {
    let home = home::home_dir().ok_or("Could not find home directory")?;
    let gitconfig_path = home.join(".gitconfig");

    // Ensure the folder path ends with /
    let folder = if scope_folder.ends_with('/') {
        scope_folder
    } else {
        format!("{}/", scope_folder)
    };

    // Build the includeIf section
    let include_section = format!(
        "\n[includeIf \"gitdir:{}\"]\n\tpath = {}\n",
        folder, config_path
    );

    // Append to ~/.gitconfig
    let mut file = fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&gitconfig_path)
        .map_err(|e| e.to_string())?;

    file.write_all(include_section.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Create a scope-specific git config file
///
/// Three signing modes are supported:
/// 1. "none" - No commit signing
/// 2. "manual" - User provides a signing key ID (for GPG keys stored on disk)
/// 3. "password_manager" - User provides raw gitconfig content (for password managers like 1Password)
#[tauri::command]
pub fn create_scope_git_config_file(
    db: State<Database>,
    scope_id: String,
    user_name: String,
    user_email: String,
    gpg_signing_method: String,
    signing_key: Option<String>,
    raw_gpg_config: Option<String>,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get scope's default folder
    let default_folder: String = conn
        .query_row(
            "SELECT default_folder FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if default_folder.is_empty() {
        return Err("Scope has no default folder set".to_string());
    }

    // Create config file path
    let config_path = Path::new(&default_folder).join(".gitconfig");
    let config_path_str = config_path.to_str().ok_or("Invalid config path")?;

    // Build config content
    let mut content = format!("[user]\n\tname = {}\n\temail = {}\n", user_name, user_email);

    let gpg_sign = match gpg_signing_method.as_str() {
        "manual" => {
            // Add commit signing with user's key
            content.push_str("\n[commit]\n\tgpgsign = true\n");
            if let Some(ref key) = signing_key {
                if !key.is_empty() {
                    content.push_str(&format!("\n[user]\n\tsigningkey = {}\n", key));
                }
            }
            true
        }
        "password_manager" => {
            // Append raw config from password manager (1Password, etc.)
            if let Some(ref raw) = raw_gpg_config {
                if !raw.is_empty() {
                    content.push_str("\n");
                    content.push_str(raw);
                    content.push_str("\n");
                }
            }
            true
        }
        _ => false, // "none" or any other value
    };

    // Write the config file
    fs::write(&config_path, &content).map_err(|e| e.to_string())?;

    // Check if includeIf already exists
    let include_ifs = read_git_include_ifs()?;
    let folder_pattern = if default_folder.ends_with('/') {
        default_folder.clone()
    } else {
        format!("{}/", default_folder)
    };
    let already_included = include_ifs.iter().any(|incl| {
        let pattern = incl.condition.trim_start_matches("gitdir:");
        let pattern = pattern.trim_start_matches("gitdir/i:");
        let pattern = pattern.trim_end_matches("**");
        let pattern = pattern.trim_end_matches('/');
        pattern == folder_pattern.trim_end_matches('/')
    });

    // Add includeIf to ~/.gitconfig if not already present
    if !already_included {
        create_git_include_if(default_folder.clone(), config_path_str.to_string())?;
    }

    // Cache the config
    conn.execute(
        r#"
        INSERT OR REPLACE INTO scope_git_config
        (scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, raw_gpg_config, config_file_path, last_checked_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "#,
        (
            &scope_id,
            &user_name,
            &user_email,
            if gpg_sign { 1 } else { 0 },
            &gpg_signing_method,
            &signing_key,
            &raw_gpg_config,
            config_path_str,
            Utc::now().to_rfc3339(),
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(config_path_str.to_string())
}

/// Refresh/update the git identity cache for a scope
#[tauri::command]
pub fn refresh_scope_git_identity(db: State<Database>, scope_id: String) -> Result<(), String> {
    // Clear the cache
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM scope_git_config WHERE scope_id = ?1",
        [&scope_id],
    )
    .map_err(|e| e.to_string())?;

    drop(conn);

    // Re-fetch (this will re-populate the cache)
    let _ = get_scope_git_identity(db, scope_id)?;

    Ok(())
}

/// Discover git config for a scope when its defaultFolder is set/changed
/// This should be called after updating a scope's defaultFolder
#[tauri::command]
pub fn discover_scope_git_config(db: State<Database>, scope_id: String) -> Result<Option<ScopeGitConfig>, String> {
    // Clear any existing cache for this scope first
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM scope_git_config WHERE scope_id = ?1",
        [&scope_id],
    )
    .map_err(|e| e.to_string())?;

    drop(conn);

    // Now try to discover the config (this will check the folder and cache if found)
    get_scope_git_identity(db, scope_id)
}

/// Validate all git config caches on application startup
/// - Clears stale cache entries where the config file no longer exists or has changed
/// - Discovers new configs for scopes with defaultFolder that have no cached config
pub fn validate_git_config_caches(db: &Database) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // PART 1: Validate existing cache entries
    let mut stmt = conn
        .prepare(
            r#"
            SELECT scope_id, user_name, user_email, gpg_sign, config_file_path
            FROM scope_git_config
            WHERE config_file_path IS NOT NULL
            "#,
        )
        .map_err(|e| e.to_string())?;

    let configs: Vec<(String, Option<String>, Option<String>, bool, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get::<_, i32>(3)? != 0,
                row.get(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    let mut stale_scope_ids = Vec::new();

    for (scope_id, cached_name, cached_email, cached_gpg_sign, config_path) in configs {
        let path = Path::new(&config_path);

        // Check if the config file still exists
        if !path.exists() {
            stale_scope_ids.push(scope_id);
            continue;
        }

        // Read current values from the file
        if let Ok((current_name, current_email, current_gpg_sign, _)) =
            read_git_identity_from_file(&config_path)
        {
            // Compare with cached values
            if current_name != cached_name
                || current_email != cached_email
                || current_gpg_sign != cached_gpg_sign
            {
                stale_scope_ids.push(scope_id);
            }
        } else {
            // Could not read the file, mark as stale
            stale_scope_ids.push(scope_id);
        }
    }

    // Clear stale cache entries
    for scope_id in &stale_scope_ids {
        conn.execute(
            "DELETE FROM scope_git_config WHERE scope_id = ?1",
            [scope_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // PART 2: Discover new configs for scopes with defaultFolder but no cache
    let mut stmt = conn
        .prepare(
            r#"
            SELECT s.id, s.default_folder
            FROM scopes s
            LEFT JOIN scope_git_config gc ON s.id = gc.scope_id
            WHERE s.default_folder IS NOT NULL
              AND s.default_folder != ''
              AND gc.scope_id IS NULL
            "#,
        )
        .map_err(|e| e.to_string())?;

    let scopes_to_check: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    // For each scope without a cache, check if .gitconfig exists in defaultFolder
    for (scope_id, default_folder) in scopes_to_check {
        let config_path = Path::new(&default_folder).join(".gitconfig");
        if config_path.exists() {
            if let Ok((name, email, gpg_sign, signing_key)) =
                read_git_identity_from_file(config_path.to_str().unwrap_or(""))
            {
                // Cache this newly discovered config
                conn.execute(
                    r#"
                    INSERT OR REPLACE INTO scope_git_config
                    (scope_id, user_name, user_email, gpg_sign, gpg_signing_method, signing_key, config_file_path, last_checked_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                    "#,
                    (
                        &scope_id,
                        &name,
                        &email,
                        if gpg_sign { 1 } else { 0 },
                        if gpg_sign { "manual" } else { "none" },
                        &signing_key,
                        config_path.to_string_lossy().to_string(),
                        Utc::now().to_rfc3339(),
                    ),
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}
