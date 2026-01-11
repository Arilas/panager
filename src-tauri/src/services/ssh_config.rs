use crate::db::models::{CreateSshAliasRequest, SshAlias};
use crate::db::Database;
use ssh2_config::{ParseRule, SshConfig};
use std::fs::{self, OpenOptions};
use std::io::{BufReader, Write};
use tauri::State;

/// Read all SSH host aliases from ~/.ssh/config
#[tauri::command]
pub fn read_ssh_aliases() -> Result<Vec<SshAlias>, String> {
    let home = home::home_dir().ok_or("Could not find home directory")?;
    let ssh_config_path = home.join(".ssh").join("config");

    if !ssh_config_path.exists() {
        return Ok(vec![]);
    }

    let file = fs::File::open(&ssh_config_path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);

    let config = SshConfig::default()
        .parse(&mut reader, ParseRule::ALLOW_UNKNOWN_FIELDS)
        .map_err(|e| format!("Failed to parse SSH config: {}", e))?;

    // Get all host names from the config
    // We need to read the file manually to get all Host entries
    let content = fs::read_to_string(&ssh_config_path).map_err(|e| e.to_string())?;
    let hosts = parse_ssh_hosts(&content);

    let mut aliases = Vec::new();
    for host in hosts {
        // Skip wildcards
        if host.contains('*') || host.contains('?') {
            continue;
        }

        let params = config.query(&host);
        aliases.push(SshAlias {
            host: host.clone(),
            host_name: params.host_name.map(|h| h.to_string()),
            user: params.user.map(|u| u.to_string()),
            identity_file: params.identity_file.and_then(|files| files.first().map(|p| p.to_string_lossy().to_string())),
        });
    }

    Ok(aliases)
}

/// Parse Host entries from SSH config content
fn parse_ssh_hosts(content: &str) -> Vec<String> {
    let mut hosts = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.to_lowercase().starts_with("host ") {
            let host = trimmed[5..].trim();
            // Can have multiple hosts on one line
            for h in host.split_whitespace() {
                hosts.push(h.to_string());
            }
        }
    }

    hosts
}

/// Get details for a specific SSH alias
#[tauri::command]
pub fn get_ssh_alias_details(host: String) -> Result<Option<SshAlias>, String> {
    let aliases = read_ssh_aliases()?;
    Ok(aliases.into_iter().find(|a| a.host == host))
}

/// Create a new SSH alias in ~/.ssh/config
///
/// Two modes are supported:
/// 1. Private Key mode: User provides `identity_file` path - SSH config references this key
/// 2. Public Key only mode: User provides `public_key` only (no identity_file) - for password
///    managers like 1Password that inject keys. We save the public key for reference but
///    don't add IdentityFile to SSH config.
#[tauri::command]
pub fn create_ssh_alias(request: CreateSshAliasRequest) -> Result<SshAlias, String> {
    let home = home::home_dir().ok_or("Could not find home directory")?;
    let ssh_dir = home.join(".ssh");
    let ssh_config_path = ssh_dir.join("config");

    // Ensure .ssh directory exists
    if !ssh_dir.exists() {
        fs::create_dir_all(&ssh_dir).map_err(|e| format!("Failed to create .ssh directory: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&ssh_dir, fs::Permissions::from_mode(0o700))
                .map_err(|e| format!("Failed to set .ssh permissions: {}", e))?;
        }
    }

    // Determine if we're using private key mode or public key only mode
    let has_identity_file = request.identity_file.as_ref().map_or(false, |f| !f.is_empty());
    let has_public_key = request.public_key.as_ref().map_or(false, |k| !k.is_empty());

    // Save public key for reference if provided (useful for copying to services)
    if has_public_key {
        let key_name = format!("{}.pub", request.host.replace('.', "_"));
        let key_path = ssh_dir.join(&key_name);

        fs::write(&key_path, request.public_key.as_ref().unwrap())
            .map_err(|e| format!("Failed to write public key: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_path, fs::Permissions::from_mode(0o644))
                .map_err(|e| format!("Failed to set key permissions: {}", e))?;
        }
    }

    // Build SSH config entry
    let mut entry = format!("\nHost {}\n", request.host);
    entry.push_str(&format!("\tHostName {}\n", request.host_name));

    let user = request.user.as_deref().unwrap_or("git");
    entry.push_str(&format!("\tUser {}\n", user));

    // Only add IdentityFile if user provided a private key path
    // (not for public key only mode - password managers handle key injection)
    if has_identity_file {
        let id_file = request.identity_file.as_ref().unwrap();
        entry.push_str(&format!("\tIdentityFile {}\n", id_file));
        entry.push_str("\tIdentitiesOnly yes\n");
    }

    // Append to SSH config
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&ssh_config_path)
        .map_err(|e| format!("Failed to open SSH config: {}", e))?;

    file.write_all(entry.as_bytes())
        .map_err(|e| format!("Failed to write to SSH config: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&ssh_config_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Failed to set config permissions: {}", e))?;
    }

    Ok(SshAlias {
        host: request.host,
        host_name: Some(request.host_name),
        user: Some(user.to_string()),
        identity_file: request.identity_file,
    })
}

/// Verify a project's remote URL uses the expected SSH alias
#[tauri::command]
pub fn verify_project_ssh_remote(
    db: State<Database>,
    project_id: String,
) -> Result<Option<SshRemoteMismatch>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get project info
    let (project_path, scope_id): (String, String) = conn
        .query_row(
            "SELECT path, scope_id FROM projects WHERE id = ?1",
            [&project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Get scope's expected SSH alias
    let expected_alias: Option<String> = conn
        .query_row(
            "SELECT ssh_alias FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let expected_alias = match expected_alias {
        Some(a) if !a.is_empty() => a,
        _ => return Ok(None),
    };

    drop(conn);

    // Get the project's remote URL
    let remote_url = get_remote_url(&project_path)?;

    if let Some(url) = remote_url {
        // Check if URL contains the expected alias
        // SSH URLs look like: git@alias:user/repo.git
        if !url.contains(&format!("@{}:", expected_alias)) &&
           !url.contains(&format!("@{}/", expected_alias)) {
            return Ok(Some(SshRemoteMismatch {
                project_id,
                expected_alias,
                actual_url: url,
            }));
        }
    }

    Ok(None)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshRemoteMismatch {
    pub project_id: String,
    pub expected_alias: String,
    pub actual_url: String,
}

/// Get the remote URL for a git repository
fn get_remote_url(project_path: &str) -> Result<Option<String>, String> {
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if url.is_empty() {
            Ok(None)
        } else {
            Ok(Some(url))
        }
    } else {
        Ok(None)
    }
}

/// Fix a project's remote URL to use the scope's SSH alias
#[tauri::command]
pub fn fix_project_ssh_remote(
    db: State<Database>,
    project_id: String,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get project and scope info
    let (project_path, scope_id): (String, String) = conn
        .query_row(
            "SELECT path, scope_id FROM projects WHERE id = ?1",
            [&project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let expected_alias: String = conn
        .query_row(
            "SELECT ssh_alias FROM scopes WHERE id = ?1",
            [&scope_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    drop(conn);

    // Get current remote URL
    let current_url = get_remote_url(&project_path)?.ok_or("No remote URL found")?;

    // Parse and rebuild URL with new alias
    let new_url = replace_ssh_host_in_url(&current_url, &expected_alias)?;

    // Update the remote
    let output = std::process::Command::new("git")
        .args(["remote", "set-url", "origin", &new_url])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(new_url)
}

/// Replace the SSH host in a git URL
fn replace_ssh_host_in_url(url: &str, new_host: &str) -> Result<String, String> {
    // Handle SSH URL format: git@host:user/repo.git
    if url.starts_with("git@") {
        // Parse: git@host:path
        if let Some(colon_pos) = url[4..].find(':') {
            let path = &url[4 + colon_pos..];
            return Ok(format!("git@{}{}", new_host, path));
        }
    }

    // Handle SSH URL format: ssh://git@host/path
    if url.starts_with("ssh://") {
        if let Some(at_pos) = url.find('@') {
            let after_at = &url[at_pos + 1..];
            if let Some(slash_pos) = after_at.find('/') {
                let path = &after_at[slash_pos..];
                return Ok(format!("ssh://git@{}{}", new_host, path));
            }
        }
    }

    Err(format!("Could not parse URL format: {}", url))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace_ssh_host() {
        assert_eq!(
            replace_ssh_host_in_url("git@github.com:user/repo.git", "github-work").unwrap(),
            "git@github-work:user/repo.git"
        );

        assert_eq!(
            replace_ssh_host_in_url("ssh://git@github.com/user/repo.git", "github-work").unwrap(),
            "ssh://git@github-work/user/repo.git"
        );
    }

    #[test]
    fn test_parse_ssh_hosts() {
        let content = r#"
Host github.com
    HostName github.com

Host work-github
    HostName github.com
    User git

Host *
    AddKeysToAgent yes
"#;
        let hosts = parse_ssh_hosts(content);
        assert_eq!(hosts, vec!["github.com", "work-github", "*"]);
    }
}
