//! Path utilities for Panager
//!
//! This module contains utilities for working with file paths.

use std::path::{Path, PathBuf};

/// Expand tilde (~) to the user's home directory
///
/// # Arguments
/// * `path` - A path string that may start with ~/
///
/// # Returns
/// The expanded path string with ~ replaced by the home directory
pub fn expand_tilde(path: &str) -> String {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(stripped).to_string_lossy().to_string();
        }
    } else if path == "~" {
        if let Some(home) = home_dir() {
            return home.to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// Get the user's home directory
///
/// Uses the `home` crate on macOS, falls back to directories crate otherwise
fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        home::home_dir()
    }
    #[cfg(not(target_os = "macos"))]
    {
        directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
    }
}

/// Normalize a path by removing trailing slashes
///
/// # Arguments
/// * `path` - A path string that may have trailing slashes
///
/// # Returns
/// The path with trailing slashes removed (except for root "/")
pub fn normalize_trailing_slash(path: &str) -> &str {
    if path == "/" {
        return path;
    }
    path.trim_end_matches('/')
}

/// Join a base path with a relative path, handling edge cases
///
/// # Arguments
/// * `base` - The base directory path
/// * `relative` - The relative path to join
///
/// # Returns
/// The combined path
pub fn join_paths(base: &str, relative: &str) -> PathBuf {
    let base = expand_tilde(base);
    let base_path = Path::new(&base);
    base_path.join(relative)
}

/// Check if a path is a subdirectory of another path
///
/// # Arguments
/// * `parent` - The potential parent directory
/// * `child` - The potential child path
///
/// # Returns
/// true if child is under parent directory
pub fn is_subdirectory(parent: &str, child: &str) -> bool {
    let parent = expand_tilde(parent);
    let child = expand_tilde(child);

    let parent_path = Path::new(&parent);
    let child_path = Path::new(&child);

    // Canonicalize both paths to resolve symlinks and normalize
    if let (Ok(parent_canon), Ok(child_canon)) = (parent_path.canonicalize(), child_path.canonicalize()) {
        child_canon.starts_with(&parent_canon)
    } else {
        // Fallback to simple string comparison if canonicalization fails
        let parent_normalized = normalize_trailing_slash(&parent);
        child.starts_with(parent_normalized) && child != parent_normalized
    }
}

/// Extract the filename from a path
///
/// # Arguments
/// * `path` - A file or directory path
///
/// # Returns
/// The filename as a string, or None if the path ends in ".."
pub fn filename(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_tilde() {
        // This test depends on the home directory existing
        let expanded = expand_tilde("~/test");
        assert!(!expanded.starts_with("~/"));
        assert!(expanded.ends_with("/test") || expanded.ends_with("\\test"));
    }

    #[test]
    fn test_expand_tilde_no_tilde() {
        let path = "/usr/local/bin";
        assert_eq!(expand_tilde(path), path);
    }

    #[test]
    fn test_normalize_trailing_slash() {
        assert_eq!(normalize_trailing_slash("/path/to/dir/"), "/path/to/dir");
        assert_eq!(normalize_trailing_slash("/path/to/dir"), "/path/to/dir");
        assert_eq!(normalize_trailing_slash("/"), "/");
    }

    #[test]
    fn test_join_paths() {
        let result = join_paths("/base", "relative");
        assert!(result.to_string_lossy().contains("base"));
        assert!(result.to_string_lossy().contains("relative"));
    }

    #[test]
    fn test_filename() {
        assert_eq!(filename("/path/to/file.txt"), Some("file.txt".to_string()));
        assert_eq!(filename("/path/to/dir/"), Some("dir".to_string()));
        assert_eq!(filename("file.txt"), Some("file.txt".to_string()));
    }
}
