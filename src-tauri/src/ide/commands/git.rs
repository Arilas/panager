//! Git-related commands for IDE

use crate::ide::types::{
    CommitOptions, FileDiff, GitBlameLine, GitBlameResult, GitBranchInfo, GitCommitInfo,
    GitFileChange, GitFileStatus, GitLocalBranch, GitStashEntry,
};
use git2::{BlameOptions, Repository, StatusOptions};
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

// ============================================================================
// Commit Commands
// ============================================================================

/// Creates a new commit with staged changes
#[tauri::command]
#[specta::specta]
pub fn ide_git_commit(
    project_path: String,
    options: CommitOptions,
) -> Result<GitCommitInfo, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get the index
    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    // Check if there are staged changes
    let staged_count = index.iter().count();
    if staged_count == 0 && !options.amend {
        return Err("No changes staged for commit".to_string());
    }

    // Write the index as a tree
    let tree_id = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    // Get the signature from git config
    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}. Please configure user.name and user.email in git config.", e))?;

    if options.amend {
        // Amend the previous commit
        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let parent_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to get parent commit: {}", e))?;

        let oid = parent_commit
            .amend(
                Some("HEAD"),
                Some(&signature),
                Some(&signature),
                None,
                Some(&options.message),
                Some(&tree),
            )
            .map_err(|e| format!("Failed to amend commit: {}", e))?;

        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        Ok(commit_to_info(&commit))
    } else {
        // Create a new commit
        let head = repo.head().ok();
        let parent_commits: Vec<git2::Commit> = match head {
            Some(h) => {
                let commit = h
                    .peel_to_commit()
                    .map_err(|e| format!("Failed to get parent commit: {}", e))?;
                vec![commit]
            }
            None => vec![], // Initial commit
        };

        let parent_refs: Vec<&git2::Commit> = parent_commits.iter().collect();

        let oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                &options.message,
                &tree,
                &parent_refs,
            )
            .map_err(|e| format!("Failed to create commit: {}", e))?;

        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        Ok(commit_to_info(&commit))
    }
}

/// Gets a summary of staged files
#[tauri::command]
#[specta::specta]
pub fn ide_git_get_staged_summary(project_path: String) -> Result<Vec<GitFileChange>, String> {
    let changes = ide_get_git_changes(project_path)?;
    Ok(changes.into_iter().filter(|c| c.staged).collect())
}

// ============================================================================
// Branch Commands
// ============================================================================

/// Lists all local branches
#[tauri::command]
#[specta::specta]
pub fn ide_git_list_branches(project_path: String) -> Result<Vec<GitLocalBranch>, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo.head().ok();
    let current_branch = head.as_ref().and_then(|h| h.shorthand().map(String::from));

    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    let mut result = Vec::new();

    for branch in branches {
        let (branch, _) = branch.map_err(|e| format!("Failed to get branch: {}", e))?;
        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();

        let is_current = current_branch.as_ref().map(|c| c == &name).unwrap_or(false);

        // Get upstream info
        let upstream = branch.upstream().ok();
        let upstream_name = upstream
            .as_ref()
            .and_then(|u| u.name().ok().flatten().map(String::from));

        // Get ahead/behind
        let (ahead, behind) = if let (Some(local_oid), Some(ref upstream_ref)) =
            (branch.get().target(), upstream.as_ref())
        {
            if let Some(upstream_oid) = upstream_ref.get().target() {
                repo.graph_ahead_behind(local_oid, upstream_oid)
                    .map(|(a, b)| (a as u32, b as u32))
                    .unwrap_or((0, 0))
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        // Get last commit
        let last_commit = branch
            .get()
            .peel_to_commit()
            .ok()
            .map(|c| commit_to_info(&c));

        result.push(GitLocalBranch {
            name,
            is_current,
            upstream: upstream_name,
            ahead,
            behind,
            last_commit,
        });
    }

    // Sort with current branch first, then alphabetically
    result.sort_by(|a, b| {
        if a.is_current {
            std::cmp::Ordering::Less
        } else if b.is_current {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(result)
}

/// Creates a new branch
#[tauri::command]
#[specta::specta]
pub fn ide_git_create_branch(
    project_path: String,
    name: String,
    from_ref: Option<String>,
    checkout: bool,
) -> Result<(), String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get the commit to branch from
    let commit = if let Some(ref_name) = from_ref {
        let reference = repo
            .resolve_reference_from_short_name(&ref_name)
            .map_err(|e| format!("Failed to resolve reference '{}': {}", ref_name, e))?;
        reference
            .peel_to_commit()
            .map_err(|e| format!("Failed to get commit: {}", e))?
    } else {
        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        head.peel_to_commit()
            .map_err(|e| format!("Failed to get HEAD commit: {}", e))?
    };

    // Create the branch
    let branch = repo
        .branch(&name, &commit, false)
        .map_err(|e| format!("Failed to create branch '{}': {}", name, e))?;

    if checkout {
        // Checkout the new branch
        let refname = branch
            .get()
            .name()
            .ok_or("Failed to get branch reference name")?;
        repo.set_head(refname)
            .map_err(|e| format!("Failed to set HEAD: {}", e))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| format!("Failed to checkout: {}", e))?;
    }

    Ok(())
}

/// Switches to a different branch
#[tauri::command]
#[specta::specta]
pub fn ide_git_switch_branch(project_path: String, name: String) -> Result<(), String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Find the branch
    let branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| format!("Branch '{}' not found: {}", name, e))?;

    let refname = branch
        .get()
        .name()
        .ok_or("Failed to get branch reference name")?;

    // Set HEAD to the branch
    repo.set_head(refname)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    // Checkout the branch
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    Ok(())
}

/// Deletes a local branch
#[tauri::command]
#[specta::specta]
pub fn ide_git_delete_branch(
    project_path: String,
    name: String,
    force: bool,
) -> Result<(), String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check if trying to delete current branch
    let head = repo.head().ok();
    let current_branch = head.as_ref().and_then(|h| h.shorthand().map(String::from));
    if current_branch.as_ref().map(|c| c == &name).unwrap_or(false) {
        return Err("Cannot delete the currently checked out branch".to_string());
    }

    // Find and delete the branch
    let mut branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| format!("Branch '{}' not found: {}", name, e))?;

    if force {
        branch
            .delete()
            .map_err(|e| format!("Failed to delete branch: {}", e))?;
    } else {
        // Check if branch is merged
        if let Some(head_ref) = repo.head().ok() {
            if let Some(head_oid) = head_ref.target() {
                if let Some(branch_oid) = branch.get().target() {
                    let is_merged = repo.merge_base(head_oid, branch_oid).ok() == Some(branch_oid);
                    if !is_merged {
                        return Err(format!(
                            "Branch '{}' is not fully merged. Use force to delete anyway.",
                            name
                        ));
                    }
                }
            }
        }
        branch
            .delete()
            .map_err(|e| format!("Failed to delete branch: {}", e))?;
    }

    Ok(())
}

/// Checks if there are uncommitted changes
#[tauri::command]
#[specta::specta]
pub fn ide_git_check_uncommitted_changes(project_path: String) -> Result<bool, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true).include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    Ok(!statuses.is_empty())
}

// ============================================================================
// Stash Commands
// ============================================================================

/// Stashes current changes
#[tauri::command]
#[specta::specta]
pub fn ide_git_stash_save(
    project_path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    let mut repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let signature = repo.signature().map_err(|e| {
        format!(
            "Failed to get signature: {}. Please configure user.name and user.email.",
            e
        )
    })?;

    let mut flags = git2::StashFlags::DEFAULT;
    if include_untracked {
        flags |= git2::StashFlags::INCLUDE_UNTRACKED;
    }

    repo.stash_save(&signature, message.as_deref().unwrap_or("WIP"), Some(flags))
        .map_err(|e| format!("Failed to stash: {}", e))?;

    Ok(())
}

/// Lists all stashes
#[tauri::command]
#[specta::specta]
pub fn ide_git_stash_list(project_path: String) -> Result<Vec<GitStashEntry>, String> {
    let mut repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // First, collect stash info without looking up commits (to avoid borrow issues)
    let mut stash_refs: Vec<(usize, String, git2::Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stash_refs.push((index, message.to_string(), *oid));
        true // Continue iterating
    })
    .map_err(|e| format!("Failed to list stashes: {}", e))?;

    // Now look up commit times
    let stashes = stash_refs
        .into_iter()
        .map(|(index, message, oid)| {
            let time = repo
                .find_commit(oid)
                .ok()
                .map(|c| c.time().seconds())
                .unwrap_or(0);

            GitStashEntry {
                index,
                message,
                oid: oid.to_string(),
                time,
            }
        })
        .collect();

    Ok(stashes)
}

/// Pops a stash (applies and removes it)
#[tauri::command]
#[specta::specta]
pub fn ide_git_stash_pop(project_path: String, index: usize) -> Result<(), String> {
    let mut repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.stash_pop(index, None)
        .map_err(|e| format!("Failed to pop stash: {}", e))?;

    Ok(())
}

/// Applies a stash without removing it
#[tauri::command]
#[specta::specta]
pub fn ide_git_stash_apply(project_path: String, index: usize) -> Result<(), String> {
    let mut repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.stash_apply(index, None)
        .map_err(|e| format!("Failed to apply stash: {}", e))?;

    Ok(())
}

/// Drops a stash
#[tauri::command]
#[specta::specta]
pub fn ide_git_stash_drop(project_path: String, index: usize) -> Result<(), String> {
    let mut repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.stash_drop(index)
        .map_err(|e| format!("Failed to drop stash: {}", e))?;

    Ok(())
}

// ============================================================================
// Blame Commands
// ============================================================================

/// Gets blame information for a file
#[tauri::command]
#[specta::specta]
pub fn ide_git_blame(project_path: String, file_path: String) -> Result<GitBlameResult, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Convert absolute file path to relative path from repo root
    let abs_file_path = Path::new(&file_path);
    let repo_root = Path::new(&project_path);
    let relative_path = abs_file_path
        .strip_prefix(repo_root)
        .map_err(|_| format!("File path '{}' is not within repository '{}'", file_path, project_path))?;

    let mut opts = BlameOptions::new();
    opts.track_copies_same_file(true);

    let blame = repo
        .blame_file(relative_path, Some(&mut opts))
        .map_err(|e| format!("Failed to get blame: {}", e))?;

    let mut lines = Vec::new();

    // Iterate over hunks and expand each to its line range
    for hunk in blame.iter() {
        let commit_id = hunk.final_commit_id().to_string();
        let signature = hunk.final_signature();
        let start_line = hunk.final_start_line();
        let num_lines = hunk.lines_in_hunk();
        let summary = get_commit_summary(&repo, &commit_id).unwrap_or_default();

        // Add an entry for each line in the hunk
        for i in 0..num_lines {
            lines.push(GitBlameLine {
                line_number: (start_line + i) as u32,
                commit_id: commit_id.clone(),
                author: signature.name().unwrap_or("Unknown").to_string(),
                author_email: signature.email().unwrap_or("").to_string(),
                timestamp: signature.when().seconds(),
                original_line_number: (hunk.orig_start_line() + i) as u32,
                summary: summary.clone(),
            });
        }
    }

    // Sort by line number (hunks may not be in order)
    lines.sort_by_key(|l| l.line_number);

    Ok(GitBlameResult {
        file_path,
        lines,
    })
}

/// Gets blame information for a single line (optimized for inline blame)
#[tauri::command]
#[specta::specta]
pub fn ide_git_blame_line(
    project_path: String,
    file_path: String,
    line: u32,
) -> Result<Option<GitBlameLine>, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Convert absolute file path to relative path from repo root
    let abs_file_path = Path::new(&file_path);
    let repo_root = Path::new(&project_path);
    let relative_path = abs_file_path
        .strip_prefix(repo_root)
        .map_err(|_| format!("File path '{}' is not within repository '{}'", file_path, project_path))?;

    let mut opts = BlameOptions::new();
    opts.track_copies_same_file(true);

    let blame = repo
        .blame_file(relative_path, Some(&mut opts))
        .map_err(|e| format!("Failed to get blame: {}", e))?;

    // Find the hunk for the specified line
    if let Some(hunk) = blame.get_line(line as usize) {
        let commit_id = hunk.final_commit_id().to_string();
        let signature = hunk.final_signature();

        Ok(Some(GitBlameLine {
            line_number: line,
            commit_id: commit_id.clone(),
            author: signature.name().unwrap_or("Unknown").to_string(),
            author_email: signature.email().unwrap_or("").to_string(),
            timestamp: signature.when().seconds(),
            original_line_number: hunk.orig_start_line() as u32,
            summary: get_commit_summary(&repo, &commit_id).unwrap_or_default(),
        }))
    } else {
        Ok(None)
    }
}

/// Gets the content of a file from HEAD (last committed version)
/// Returns None if the file is not tracked or doesn't exist in HEAD
#[tauri::command]
#[specta::specta]
pub fn ide_git_show_head(project_path: String, file_path: String) -> Result<Option<String>, String> {
    let repo =
        Repository::open(&project_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Convert absolute file path to relative path from repo root
    let abs_file_path = Path::new(&file_path);
    let repo_root = Path::new(&project_path);
    let relative_path = abs_file_path
        .strip_prefix(repo_root)
        .map_err(|_| format!("File path '{}' is not within repository '{}'", file_path, project_path))?;

    // Get HEAD commit
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(None), // No HEAD (empty repo)
    };

    let commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get tree: {}", e))?;

    // Try to find the file in the tree
    let entry = match tree.get_path(relative_path) {
        Ok(e) => e,
        Err(_) => return Ok(None), // File not in tree (new file)
    };

    // Get the blob content
    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| format!("Failed to get blob: {}", e))?;

    // Convert to string (only works for text files)
    match std::str::from_utf8(blob.content()) {
        Ok(content) => Ok(Some(content.to_string())),
        Err(_) => Ok(None), // Binary file
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Converts a git2 Commit to GitCommitInfo
fn commit_to_info(commit: &git2::Commit) -> GitCommitInfo {
    let oid = commit.id().to_string();
    GitCommitInfo {
        oid: oid.clone(),
        short_id: oid.chars().take(7).collect(),
        message: commit.message().unwrap_or("").to_string(),
        author_name: commit.author().name().unwrap_or("Unknown").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        author_time: commit.author().when().seconds(),
    }
}

/// Gets the summary (first line) of a commit message
fn get_commit_summary(repo: &Repository, commit_id: &str) -> Option<String> {
    let oid = git2::Oid::from_str(commit_id).ok()?;
    let commit = repo.find_commit(oid).ok()?;
    let message = commit.message()?;
    Some(message.lines().next().unwrap_or("").to_string())
}
