//! POSIX filesystem operations
//!
//! Provides Unix-style permission management for files and directories.
//! These functions use standard POSIX permission modes (octal).

use std::fs;
use std::io;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// Set file permissions to 0600 (owner read/write only)
///
/// Use for sensitive files like SSH private keys, config files with secrets.
pub fn set_secure_file_permissions(path: &Path) -> io::Result<()> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
}

/// Set file permissions to 0644 (owner read/write, others read)
///
/// Use for public files like SSH public keys.
pub fn set_public_file_permissions(path: &Path) -> io::Result<()> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o644))
}

/// Set directory permissions to 0700 (owner only)
///
/// Use for sensitive directories like .ssh.
pub fn set_secure_directory_permissions(path: &Path) -> io::Result<()> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
}

// Tests require tempfile dev dependency - run manually if needed:
// cargo test --features test-filesystem -- platform::posix::filesystem
