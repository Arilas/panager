//! Git-related commands for IDE

use crate::ide::types::{FileDiff, GitBranchInfo, GitFileChange, GitFileStatus};
use git2::{Repository, StatusOptions};
use std::path::Path;
use tracing::debug;

/// Gets the current git status for a project
#[tauri::command]
#[specta::specta]
pub fn ide_get_git_changes(project_path: String) -> Result<Vec<GitFileChange>, String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .include_unmodified(false);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| format!("Failed to get status: {}", e))?;

    debug!("Found {} status entries", statuses.len());

    let mut changes: Vec<GitFileChange> = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        if path.is_empty() {
            continue;
        }

        // Handle index (staged) changes
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_renamed()
        {
            let file_status = if status.is_index_new() {
                GitFileStatus::Added
            } else if status.is_index_deleted() {
                GitFileStatus::Deleted
            } else if status.is_index_renamed() {
                GitFileStatus::Renamed
            } else {
                GitFileStatus::Modified
            };

            // Check if we already added this path as unstaged
            let existing = changes.iter_mut().find(|c| c.path == path && !c.staged);
            if existing.is_none() {
                changes.push(GitFileChange {
                    path: path.clone(),
                    status: file_status,
                    staged: true,
                    old_path: None, // TODO: handle renames
                });
            }
        }

        // Handle working tree (unstaged) changes
        if status.is_wt_new()
            || status.is_wt_modified()
            || status.is_wt_deleted()
            || status.is_wt_renamed()
        {
            let file_status = if status.is_wt_new() {
                GitFileStatus::Untracked
            } else if status.is_wt_deleted() {
                GitFileStatus::Deleted
            } else if status.is_wt_renamed() {
                GitFileStatus::Renamed
            } else {
                GitFileStatus::Modified
            };

            changes.push(GitFileChange {
                path: path.clone(),
                status: file_status,
                staged: false,
                old_path: None,
            });
        }

        // Handle conflicts
        if status.is_conflicted() {
            changes.push(GitFileChange {
                path: path.clone(),
                status: GitFileStatus::Conflicted,
                staged: false,
                old_path: None,
            });
        }
    }

    // Sort by path
    changes.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(changes)
}

/// Gets the diff for a specific file
#[tauri::command]
#[specta::specta]
pub fn ide_get_file_diff(
    project_path: String,
    file_path: String,
    staged: bool,
) -> Result<FileDiff, String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let full_path = Path::new(&project_path).join(&file_path);

    // Get the original content from HEAD
    let original_content = get_file_content_at_head(&repo, &file_path).unwrap_or_default();

    // Get the modified content
    let modified_content = if staged {
        get_file_content_at_index(&repo, &file_path).unwrap_or_default()
    } else {
        std::fs::read_to_string(&full_path).unwrap_or_default()
    };

    // Check if binary
    let is_binary = is_binary_content(&original_content) || is_binary_content(&modified_content);

    Ok(FileDiff {
        original_content: if is_binary {
            String::new()
        } else {
            original_content
        },
        modified_content: if is_binary {
            String::new()
        } else {
            modified_content
        },
        is_binary,
    })
}

/// Gets the current git branch info
#[tauri::command]
#[specta::specta]
pub fn ide_get_git_branch(project_path: String) -> Result<GitBranchInfo, String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get current branch name
    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let branch_name = head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string();

    // Check for uncommitted changes
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let has_changes = !statuses.is_empty();

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo).unwrap_or((0, 0));

    Ok(GitBranchInfo {
        name: branch_name,
        has_changes,
        ahead,
        behind,
    })
}

/// Stages a file for commit
#[tauri::command]
#[specta::specta]
pub fn ide_stage_file(project_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;

    let path = Path::new(&file_path);
    index.add_path(path).map_err(|e| format!("Failed to stage file: {}", e))?;
    index.write().map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Unstages a file
#[tauri::command]
#[specta::specta]
pub fn ide_unstage_file(project_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let _head_tree = head_commit.tree().map_err(|e| e.to_string())?;

    repo.reset_default(Some(&head_commit.as_object()), [Path::new(&file_path)])
        .map_err(|e| format!("Failed to unstage file: {}", e))?;

    Ok(())
}

/// Discards changes to a file
#[tauri::command]
#[specta::specta]
pub fn ide_discard_changes(project_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.path(&file_path);
    checkout_opts.force();

    repo.checkout_head(Some(&mut checkout_opts))
        .map_err(|e| format!("Failed to discard changes: {}", e))?;

    Ok(())
}

// Helper functions

fn get_file_content_at_head(repo: &Repository, file_path: &str) -> Result<String, String> {
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let tree = head_commit.tree().map_err(|e| e.to_string())?;

    let entry = tree
        .get_path(Path::new(file_path))
        .map_err(|_| "File not found in HEAD".to_string())?;

    let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;

    String::from_utf8(blob.content().to_vec())
        .map_err(|_| "File is binary".to_string())
}

fn get_file_content_at_index(repo: &Repository, file_path: &str) -> Result<String, String> {
    let index = repo.index().map_err(|e| e.to_string())?;

    let entry = index
        .get_path(Path::new(file_path), 0)
        .ok_or_else(|| "File not found in index".to_string())?;

    let blob = repo.find_blob(entry.id).map_err(|e| e.to_string())?;

    String::from_utf8(blob.content().to_vec())
        .map_err(|_| "File is binary".to_string())
}

fn get_ahead_behind(repo: &Repository) -> Result<(u32, u32), String> {
    let head = repo.head().map_err(|e| e.to_string())?;

    if !head.is_branch() {
        return Ok((0, 0));
    }

    let branch_name = head.shorthand().unwrap_or("");
    let local_oid = head.target().ok_or("No local OID")?;

    // Try to find the upstream branch
    let branch = repo
        .find_branch(branch_name, git2::BranchType::Local)
        .map_err(|e| e.to_string())?;

    let upstream = match branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0)), // No upstream
    };

    let upstream_oid = upstream
        .get()
        .target()
        .ok_or("No upstream OID")?;

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|e| e.to_string())?;

    Ok((ahead as u32, behind as u32))
}

fn is_binary_content(content: &str) -> bool {
    // Check for null bytes in the first 8000 characters
    content.chars().take(8000).any(|c| c == '\0')
}
