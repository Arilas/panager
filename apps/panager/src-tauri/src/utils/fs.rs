//! Filesystem utilities for Panager
//!
//! This module contains utilities for filesystem operations.

use std::fs;
use std::path::Path;

use crate::error::{PanagerError, Result};

/// Check if a directory exists
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// true if the path exists and is a directory
pub fn directory_exists(path: &str) -> bool {
    let path = super::paths::expand_tilde(path);
    Path::new(&path).is_dir()
}

/// Check if a file exists
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// true if the path exists and is a file
pub fn file_exists(path: &str) -> bool {
    let path = super::paths::expand_tilde(path);
    Path::new(&path).is_file()
}

/// Check if any path (file or directory) exists
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// true if the path exists
pub fn path_exists(path: &str) -> bool {
    let path = super::paths::expand_tilde(path);
    Path::new(&path).exists()
}

/// Create a directory and all parent directories
///
/// # Arguments
/// * `path` - Path to create
///
/// # Returns
/// Result indicating success or failure
pub fn create_dir_all(path: &str) -> Result<()> {
    let path = super::paths::expand_tilde(path);
    fs::create_dir_all(&path).map_err(PanagerError::Io)
}

/// Remove a directory and all its contents
///
/// # Arguments
/// * `path` - Path to remove
///
/// # Returns
/// Result indicating success or failure
pub fn remove_dir_all(path: &str) -> Result<()> {
    let path = super::paths::expand_tilde(path);
    fs::remove_dir_all(&path).map_err(PanagerError::Io)
}

/// Read a file to string
///
/// # Arguments
/// * `path` - Path to read
///
/// # Returns
/// The file contents as a string
pub fn read_to_string(path: &str) -> Result<String> {
    let path = super::paths::expand_tilde(path);
    fs::read_to_string(&path).map_err(PanagerError::Io)
}

/// Write a string to a file
///
/// # Arguments
/// * `path` - Path to write
/// * `contents` - String contents to write
///
/// # Returns
/// Result indicating success or failure
pub fn write_string(path: &str, contents: &str) -> Result<()> {
    let path = super::paths::expand_tilde(path);

    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(PanagerError::Io)?;
        }
    }

    fs::write(&path, contents).map_err(PanagerError::Io)
}

/// Append a string to a file
///
/// # Arguments
/// * `path` - Path to append to
/// * `contents` - String contents to append
///
/// # Returns
/// Result indicating success or failure
pub fn append_string(path: &str, contents: &str) -> Result<()> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let path = super::paths::expand_tilde(path);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(PanagerError::Io)?;

    file.write_all(contents.as_bytes()).map_err(PanagerError::Io)
}

/// Move a file or directory
///
/// # Arguments
/// * `from` - Source path
/// * `to` - Destination path
///
/// # Returns
/// Result indicating success or failure
pub fn move_path(from: &str, to: &str) -> Result<()> {
    let from = super::paths::expand_tilde(from);
    let to = super::paths::expand_tilde(to);

    fs::rename(&from, &to).map_err(PanagerError::Io)
}

/// Copy a file
///
/// # Arguments
/// * `from` - Source path
/// * `to` - Destination path
///
/// # Returns
/// The number of bytes copied
pub fn copy_file(from: &str, to: &str) -> Result<u64> {
    let from = super::paths::expand_tilde(from);
    let to = super::paths::expand_tilde(to);

    fs::copy(&from, &to).map_err(PanagerError::Io)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_directory_exists() {
        // Current directory should always exist
        assert!(directory_exists("."));
        // Non-existent path should return false
        assert!(!directory_exists("/this/path/should/not/exist/12345"));
    }

    #[test]
    fn test_file_exists() {
        // Cargo.toml should exist in the project root
        assert!(!file_exists("/this/file/should/not/exist.txt"));
    }

    #[test]
    fn test_path_exists() {
        assert!(path_exists("."));
        assert!(!path_exists("/this/path/should/not/exist/12345"));
    }

    #[test]
    fn test_create_and_remove_dir() {
        let temp_dir = env::temp_dir().join("panager_test_dir");
        let path = temp_dir.to_string_lossy().to_string();

        // Clean up if exists from previous test
        let _ = remove_dir_all(&path);

        // Create directory
        assert!(create_dir_all(&path).is_ok());
        assert!(directory_exists(&path));

        // Remove directory
        assert!(remove_dir_all(&path).is_ok());
        assert!(!directory_exists(&path));
    }

    #[test]
    fn test_read_write_string() {
        let temp_file = env::temp_dir().join("panager_test_file.txt");
        let path = temp_file.to_string_lossy().to_string();

        // Write to file
        let content = "Hello, Panager!";
        assert!(write_string(&path, content).is_ok());

        // Read from file
        let read_content = read_to_string(&path).unwrap();
        assert_eq!(read_content, content);

        // Clean up
        let _ = std::fs::remove_file(&temp_file);
    }
}
