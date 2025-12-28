use crate::db::models::GitStatusCache;
use crate::db::Database;
use chrono::Utc;
use git2::{Repository, StatusOptions};
use std::path::Path;
use std::process::Command;
use tauri::State;

#[derive(Debug, serde::Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub has_uncommitted: bool,
    pub has_untracked: bool,
    pub remote_url: Option<String>,
}

#[tauri::command]
pub fn get_git_status(project_path: String) -> Result<GitStatus, String> {
    let path = Path::new(&project_path);
    let repo = Repository::open(path).map_err(|e| e.to_string())?;

    let branch = get_current_branch(&repo);
    let (ahead, behind) = get_ahead_behind(&repo).unwrap_or((0, 0));
    let (has_uncommitted, has_untracked) = get_status_flags(&repo);
    let remote_url = get_remote_url(&repo);

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        has_uncommitted,
        has_untracked,
        remote_url,
    })
}

#[tauri::command]
pub fn refresh_git_status(db: State<Database>, project_id: String, project_path: String) -> Result<GitStatusCache, String> {
    let status = get_git_status(project_path)?;
    let now = Utc::now();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        INSERT OR REPLACE INTO git_status_cache
        (project_id, branch, ahead, behind, has_uncommitted, has_untracked, last_checked_at, remote_url)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        (
            &project_id,
            &status.branch,
            status.ahead,
            status.behind,
            status.has_uncommitted as i32,
            status.has_untracked as i32,
            now.to_rfc3339(),
            &status.remote_url,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(GitStatusCache {
        project_id,
        branch: status.branch,
        ahead: status.ahead,
        behind: status.behind,
        has_uncommitted: status.has_uncommitted,
        has_untracked: status.has_untracked,
        last_checked_at: Some(now),
        remote_url: status.remote_url,
    })
}

#[tauri::command]
pub fn git_pull(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["pull"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn git_push(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn get_current_branch(repo: &Repository) -> Option<String> {
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
}

fn get_ahead_behind(repo: &Repository) -> Option<(i32, i32)> {
    let head = repo.head().ok()?;
    let local_oid = head.target()?;

    let branch_name = head.shorthand()?;
    let upstream_name = format!("origin/{}", branch_name);

    let upstream_ref = repo.find_reference(&format!("refs/remotes/{}", upstream_name)).ok()?;
    let upstream_oid = upstream_ref.target()?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid).ok()?;

    Some((ahead as i32, behind as i32))
}

fn get_status_flags(repo: &Repository) -> (bool, bool) {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(false);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(_) => return (false, false),
    };

    let mut has_uncommitted = false;
    let mut has_untracked = false;

    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_wt_new() {
            has_untracked = true;
        }
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_wt_modified()
            || status.is_wt_deleted()
        {
            has_uncommitted = true;
        }
    }

    (has_uncommitted, has_untracked)
}

fn get_remote_url(repo: &Repository) -> Option<String> {
    repo.find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(|s| s.to_string()))
}
