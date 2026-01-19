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
    /// Whether this file/directory is ignored by .gitignore
    pub is_gitignored: bool,
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

/// Git commit information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    /// Full commit OID
    pub oid: String,
    /// Short commit ID (7 chars)
    pub short_id: String,
    /// Commit message
    pub message: String,
    /// Author name
    pub author_name: String,
    /// Author email
    pub author_email: String,
    /// Author timestamp (Unix epoch seconds)
    pub author_time: i64,
}

/// Options for creating a commit
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitOptions {
    /// Commit message
    pub message: String,
    /// Whether to amend the previous commit
    pub amend: bool,
}

/// Git stash entry
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitStashEntry {
    /// Stash index (0 = most recent)
    pub index: usize,
    /// Stash message
    pub message: String,
    /// Stash commit OID
    pub oid: String,
    /// Timestamp when stash was created
    pub time: i64,
}

/// Local branch information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitLocalBranch {
    /// Branch name
    pub name: String,
    /// Whether this is the current branch
    pub is_current: bool,
    /// Upstream tracking branch (if any)
    pub upstream: Option<String>,
    /// Commits ahead of upstream
    pub ahead: u32,
    /// Commits behind upstream
    pub behind: u32,
    /// Last commit on this branch
    pub last_commit: Option<GitCommitInfo>,
}

/// Git blame information for a single line
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitBlameLine {
    /// Line number (1-indexed)
    pub line_number: u32,
    /// Commit ID that last modified this line
    pub commit_id: String,
    /// Author name
    pub author: String,
    /// Author email
    pub author_email: String,
    /// Timestamp of the commit
    pub timestamp: i64,
    /// Original line number in the commit
    pub original_line_number: u32,
    /// First line of the commit message
    pub summary: String,
}

/// Git blame result for a file
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitBlameResult {
    /// Path to the blamed file
    pub file_path: String,
    /// Blame info for each line
    pub lines: Vec<GitBlameLine>,
}

/// Git operation progress
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitProgress {
    /// Operation name (push, pull, fetch, etc.)
    pub operation: String,
    /// Current stage of the operation
    pub stage: String,
    /// Current progress value
    pub current: u32,
    /// Total expected value
    pub total: u32,
    /// Optional message
    pub message: Option<String>,
}
