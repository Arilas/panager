//! Home directory resolution for POSIX systems
//!
//! Provides consistent home directory resolution for macOS and Linux
//! using the `home` crate which handles edge cases properly.

use std::path::PathBuf;

/// Get the user's home directory
///
/// Uses the `home` crate which handles edge cases properly on both
/// macOS and Linux:
/// - Respects $HOME environment variable
/// - Handles sudo correctly (returns actual user's home, not root's)
/// - Falls back to /etc/passwd on Linux if needed
pub fn home_dir() -> Option<PathBuf> {
    home::home_dir()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_home_dir_exists() {
        let home = home_dir();
        assert!(home.is_some(), "Home directory should be found");

        let home_path = home.unwrap();
        assert!(home_path.exists(), "Home directory should exist");
        assert!(home_path.is_dir(), "Home directory should be a directory");
    }
}
