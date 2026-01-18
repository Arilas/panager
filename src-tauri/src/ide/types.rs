//! IDE-specific type definitions

use serde::{Deserialize, Serialize};
use specta::Type;

/// Represents a file or directory entry in the file tree
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// File or directory name
    pub name: String,
    /// Full path to the file or directory
    pub path: String,
    /// Whether this entry is a directory
    pub is_directory: bool,
    /// Child entries (only populated for directories when expanded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
    /// File extension (for files only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    /// Whether this is a hidden file (starts with .)
    pub is_hidden: bool,
}

/// Represents a file change in git
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    /// Path to the changed file (relative to project root)
    pub path: String,
    /// Type of change
    pub status: GitFileStatus,
    /// Whether the file is staged
    pub staged: bool,
    /// Old path for renamed files
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

/// Git file status types
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GitFileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
}

/// Represents a diff between two versions of a file
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    /// Original content (from HEAD or index)
    pub original_content: String,
    /// Modified content (from working tree or index)
    pub modified_content: String,
    /// Whether the file is binary
    pub is_binary: bool,
}

/// File read result with content and metadata
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    /// The file content as a string
    pub content: String,
    /// Detected language for syntax highlighting
    pub language: String,
    /// File size in bytes
    pub size: u64,
    /// Whether the file is binary
    pub is_binary: bool,
}

/// Search result for file content search
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// Path to the file containing the match
    pub file_path: String,
    /// Line number of the match (1-indexed)
    pub line_number: u32,
    /// The line content containing the match
    pub line_content: String,
    /// Start position of the match within the line
    pub match_start: u32,
    /// End position of the match within the line
    pub match_end: u32,
}

/// File system event types for live updates
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum IdeFileEvent {
    Created { path: String },
    Deleted { path: String },
    Modified { path: String },
    Renamed { old_path: String, new_path: String },
}

/// Git branch info
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    /// Current branch name
    pub name: String,
    /// Whether there are uncommitted changes
    pub has_changes: bool,
    /// Number of commits ahead of remote
    pub ahead: u32,
    /// Number of commits behind remote
    pub behind: u32,
}
