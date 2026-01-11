//! Compiled regex patterns for Panager
//!
//! This module contains lazily-compiled regex patterns used throughout the application.
//! Using once_cell ensures patterns are compiled only once and reused.

#[cfg(target_os = "macos")]
use once_cell::sync::Lazy;
#[cfg(target_os = "macos")]
use regex::Regex;

// Git config patterns
#[cfg(target_os = "macos")]
pub static GIT_NAME_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"^\s*name\s*=\s*(.+)$"#).expect("Invalid GIT_NAME_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_EMAIL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"^\s*email\s*=\s*(.+)$"#).expect("Invalid GIT_EMAIL_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_GPG_SIGN_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"^\s*gpgsign\s*=\s*(true|1)"#).expect("Invalid GIT_GPG_SIGN_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_SIGNING_KEY_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"^\s*signingkey\s*=\s*(.+)$"#).expect("Invalid GIT_SIGNING_KEY_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_INCLUDE_IF_SECTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"\[includeIf\s+"([^"]+)"\]"#).expect("Invalid GIT_INCLUDE_IF_SECTION_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_PATH_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"^\s*path\s*=\s*(.+)$"#).expect("Invalid GIT_PATH_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_USER_SECTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"\[user\]"#).expect("Invalid GIT_USER_SECTION_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_COMMIT_SECTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"\[commit\]"#).expect("Invalid GIT_COMMIT_SECTION_REGEX pattern")
});

// Git URL patterns
#[cfg(target_os = "macos")]
pub static GIT_SSH_SCP_REGEX: Lazy<Regex> = Lazy::new(|| {
    // Matches: git@host:owner/repo.git or git@host:owner/repo
    Regex::new(r#"^(?P<user>[^@]+)@(?P<host>[^:]+):(?P<path>.+?)(?:\.git)?$"#)
        .expect("Invalid GIT_SSH_SCP_REGEX pattern")
});

#[cfg(target_os = "macos")]
pub static GIT_HTTP_CREDENTIALS_REGEX: Lazy<Regex> = Lazy::new(|| {
    // Matches URLs with embedded credentials: https://user:pass@host/path
    Regex::new(r#"https?://[^@]+@"#).expect("Invalid GIT_HTTP_CREDENTIALS_REGEX pattern")
});

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_name_regex() {
        assert!(GIT_NAME_REGEX.is_match("  name = John Doe"));
        assert!(GIT_NAME_REGEX.is_match("name = John Doe"));
        assert!(!GIT_NAME_REGEX.is_match("email = test@example.com"));
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_email_regex() {
        assert!(GIT_EMAIL_REGEX.is_match("  email = test@example.com"));
        assert!(GIT_EMAIL_REGEX.is_match("email = test@example.com"));
        assert!(!GIT_EMAIL_REGEX.is_match("name = John Doe"));
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_gpg_sign_regex() {
        assert!(GIT_GPG_SIGN_REGEX.is_match("  gpgsign = true"));
        assert!(GIT_GPG_SIGN_REGEX.is_match("gpgsign = 1"));
        assert!(!GIT_GPG_SIGN_REGEX.is_match("gpgsign = false"));
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_include_if_section_regex() {
        assert!(GIT_INCLUDE_IF_SECTION_REGEX.is_match(r#"[includeIf "gitdir:~/work/"]"#));
        assert!(GIT_INCLUDE_IF_SECTION_REGEX.is_match(r#"[includeIf "gitdir/i:~/Work/"]"#));
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_ssh_scp_regex() {
        let caps = GIT_SSH_SCP_REGEX.captures("git@github.com:owner/repo.git").unwrap();
        assert_eq!(caps.name("user").unwrap().as_str(), "git");
        assert_eq!(caps.name("host").unwrap().as_str(), "github.com");
        assert_eq!(caps.name("path").unwrap().as_str(), "owner/repo");
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_git_http_credentials_regex() {
        assert!(GIT_HTTP_CREDENTIALS_REGEX.is_match("https://user:pass@github.com/owner/repo"));
        assert!(GIT_HTTP_CREDENTIALS_REGEX.is_match("http://user@github.com/owner/repo"));
        assert!(!GIT_HTTP_CREDENTIALS_REGEX.is_match("https://github.com/owner/repo"));
    }
}
