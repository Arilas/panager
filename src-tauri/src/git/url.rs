//! Git URL parsing and transformation utilities
//!
//! Supports:
//! - SSH format: git@host:owner/repo.git
//! - SSH protocol: ssh://git@host/owner/repo.git (with optional port)
//! - HTTP/HTTPS: https://host/owner/repo.git (with optional credentials)

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ParsedGitUrl {
    /// The protocol used (ssh, http, https)
    pub protocol: String,
    /// The hostname (e.g., github.com)
    pub host: String,
    /// Optional port for SSH protocol URLs
    pub port: Option<u16>,
    /// SSH user (usually "git")
    pub user: Option<String>,
    /// Whether the URL contains HTTP basic auth credentials
    pub has_http_credentials: bool,
    /// The owner/org (e.g., "anthropics")
    pub owner: String,
    /// The repository name without .git (e.g., "claude")
    pub repo: String,
    /// If the URL already uses a known SSH alias
    pub uses_alias: Option<String>,
    /// The original URL as provided
    pub original_url: String,
}

/// Parse a git URL into its components
#[tauri::command]
#[specta::specta]
pub fn parse_git_url(url: &str, known_aliases: Vec<String>) -> Result<ParsedGitUrl, String> {
    let url = url.trim();

    // Try SSH format: git@host:owner/repo.git
    if let Some(parsed) = try_parse_ssh_scp(url, &known_aliases) {
        return Ok(parsed);
    }

    // Try SSH protocol: ssh://git@host[:port]/owner/repo.git
    if let Some(parsed) = try_parse_ssh_protocol(url, &known_aliases) {
        return Ok(parsed);
    }

    // Try HTTP/HTTPS: https://[user:pass@]host/owner/repo.git
    if let Some(parsed) = try_parse_http(url) {
        return Ok(parsed);
    }

    Err(format!("Could not parse git URL: {}", url))
}

/// Try to parse SSH SCP-like format: git@host:owner/repo.git
fn try_parse_ssh_scp(url: &str, known_aliases: &[String]) -> Option<ParsedGitUrl> {
    // Skip if this looks like a URL with protocol (contains ://)
    if url.contains("://") {
        return None;
    }

    // Pattern: [user@]host:owner/repo[.git]
    let re = Regex::new(r"^(?:([^@]+)@)?([^:]+):(.+)/([^/]+?)(?:\.git)?$").ok()?;
    let caps = re.captures(url)?;

    let user = caps.get(1).map(|m| m.as_str().to_string());
    let host = caps.get(2)?.as_str().to_string();
    let owner = caps.get(3)?.as_str().to_string();
    let repo = caps.get(4)?.as_str().to_string();

    // Check if host is a known alias
    let uses_alias = if known_aliases.contains(&host) {
        Some(host.clone())
    } else {
        None
    };

    Some(ParsedGitUrl {
        protocol: "ssh".to_string(),
        host,
        port: None,
        user,
        has_http_credentials: false,
        owner,
        repo,
        uses_alias,
        original_url: url.to_string(),
    })
}

/// Try to parse SSH protocol format: ssh://git@host[:port]/owner/repo.git
fn try_parse_ssh_protocol(url: &str, known_aliases: &[String]) -> Option<ParsedGitUrl> {
    if !url.starts_with("ssh://") {
        return None;
    }

    // Pattern: ssh://[user@]host[:port]/owner/repo[.git]
    let re = Regex::new(r"^ssh://(?:([^@]+)@)?([^/:]+)(?::(\d+))?/(.+)/([^/]+?)(?:\.git)?$").ok()?;
    let caps = re.captures(url)?;

    let user = caps.get(1).map(|m| m.as_str().to_string());
    let host = caps.get(2)?.as_str().to_string();
    let port = caps.get(3).and_then(|m| m.as_str().parse().ok());
    let owner = caps.get(4)?.as_str().to_string();
    let repo = caps.get(5)?.as_str().to_string();

    let uses_alias = if known_aliases.contains(&host) {
        Some(host.clone())
    } else {
        None
    };

    Some(ParsedGitUrl {
        protocol: "ssh".to_string(),
        host,
        port,
        user,
        has_http_credentials: false,
        owner,
        repo,
        uses_alias,
        original_url: url.to_string(),
    })
}

/// Try to parse HTTP/HTTPS format: https://[user:pass@]host/owner/repo.git
fn try_parse_http(url: &str) -> Option<ParsedGitUrl> {
    let protocol = if url.starts_with("https://") {
        "https"
    } else if url.starts_with("http://") {
        "http"
    } else {
        return None;
    };

    // Pattern: http[s]://[user[:pass]@]host/owner/repo[.git]
    let re = Regex::new(
        r"^https?://(?:([^:@]+)(?::([^@]+))?@)?([^/]+)/(.+)/([^/]+?)(?:\.git)?$"
    ).ok()?;
    let caps = re.captures(url)?;

    let http_user = caps.get(1).map(|m| m.as_str());
    let http_pass = caps.get(2).map(|m| m.as_str());
    let host = caps.get(3)?.as_str().to_string();
    let owner = caps.get(4)?.as_str().to_string();
    let repo = caps.get(5)?.as_str().to_string();

    let has_http_credentials = http_user.is_some() || http_pass.is_some();

    Some(ParsedGitUrl {
        protocol: protocol.to_string(),
        host,
        port: None,
        user: None,
        has_http_credentials,
        owner,
        repo,
        uses_alias: None,
        original_url: url.to_string(),
    })
}

/// Build an SSH URL from parsed components using an alias
pub fn build_ssh_url_with_alias(parsed: &ParsedGitUrl, alias: &str) -> String {
    // If original had port, use ssh:// format to preserve it
    if let Some(port) = parsed.port {
        format!("ssh://git@{}:{}/{}/{}.git", alias, port, parsed.owner, parsed.repo)
    } else {
        // Use standard SCP format
        format!("git@{}:{}/{}.git", alias, parsed.owner, parsed.repo)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ssh_scp_format() {
        let result = parse_git_url("git@github.com:anthropics/claude.git", vec![]).unwrap();
        assert_eq!(result.protocol, "ssh");
        assert_eq!(result.host, "github.com");
        assert_eq!(result.owner, "anthropics");
        assert_eq!(result.repo, "claude");
        assert_eq!(result.user, Some("git".to_string()));
        assert!(result.uses_alias.is_none());
    }

    #[test]
    fn test_parse_ssh_scp_with_alias() {
        let aliases = vec!["github-work".to_string()];
        let result = parse_git_url("git@github-work:anthropics/claude.git", aliases).unwrap();
        assert_eq!(result.host, "github-work");
        assert_eq!(result.uses_alias, Some("github-work".to_string()));
    }

    #[test]
    fn test_parse_ssh_protocol() {
        let result = parse_git_url("ssh://git@github.com/anthropics/claude.git", vec![]).unwrap();
        assert_eq!(result.protocol, "ssh");
        assert_eq!(result.host, "github.com");
        assert_eq!(result.owner, "anthropics");
        assert_eq!(result.repo, "claude");
    }

    #[test]
    fn test_parse_ssh_protocol_with_port() {
        let result = parse_git_url("ssh://git@github.com:2222/anthropics/claude.git", vec![]).unwrap();
        assert_eq!(result.port, Some(2222));
    }

    #[test]
    fn test_parse_https() {
        let result = parse_git_url("https://github.com/anthropics/claude.git", vec![]).unwrap();
        assert_eq!(result.protocol, "https");
        assert_eq!(result.host, "github.com");
        assert_eq!(result.owner, "anthropics");
        assert_eq!(result.repo, "claude");
        assert!(!result.has_http_credentials);
    }

    #[test]
    fn test_parse_https_with_credentials() {
        let result = parse_git_url("https://user:token@github.com/anthropics/claude.git", vec![]).unwrap();
        assert!(result.has_http_credentials);
    }

    #[test]
    fn test_parse_without_git_extension() {
        let result = parse_git_url("https://github.com/anthropics/claude", vec![]).unwrap();
        assert_eq!(result.repo, "claude");
    }

    #[test]
    fn test_build_ssh_url_with_alias() {
        let parsed = ParsedGitUrl {
            protocol: "https".to_string(),
            host: "github.com".to_string(),
            port: None,
            user: None,
            has_http_credentials: false,
            owner: "anthropics".to_string(),
            repo: "claude".to_string(),
            uses_alias: None,
            original_url: "https://github.com/anthropics/claude.git".to_string(),
        };

        let result = build_ssh_url_with_alias(&parsed, "github-work");
        assert_eq!(result, "git@github-work:anthropics/claude.git");
    }

    #[test]
    fn test_build_ssh_url_with_port() {
        let parsed = ParsedGitUrl {
            protocol: "ssh".to_string(),
            host: "github.com".to_string(),
            port: Some(2222),
            user: Some("git".to_string()),
            has_http_credentials: false,
            owner: "anthropics".to_string(),
            repo: "claude".to_string(),
            uses_alias: None,
            original_url: "ssh://git@github.com:2222/anthropics/claude.git".to_string(),
        };

        let result = build_ssh_url_with_alias(&parsed, "github-work");
        assert_eq!(result, "ssh://git@github-work:2222/anthropics/claude.git");
    }
}
