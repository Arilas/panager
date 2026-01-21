use crate::db::models::{
    ContributorInfo, CreateProjectCommandRequest, CreateProjectGroupRequest,
    CreateProjectLinkRequest, CreateProjectRequest, GitStatusCache, LanguageInfo, LastCommitInfo,
    Project, ProjectCommand, ProjectGroup, ProjectLink, ProjectStatistics, ProjectWithStatus,
};
use crate::db::repository::{
    assign_project_to_group as repo_assign_project_to_group,
    create_project_command as repo_create_project_command,
    create_project_group as repo_create_project_group,
    create_project_link as repo_create_project_link,
    delete_project_command as repo_delete_project_command,
    delete_project_group as repo_delete_project_group,
    delete_project_link as repo_delete_project_link,
    get_project_command_by_id as repo_get_project_command_by_id,
    get_project_commands as repo_get_project_commands,
    get_project_groups as repo_get_project_groups,
    get_project_links as repo_get_project_links,
};
use crate::db::Database;
use chrono::{DateTime, Utc};
use git2::Repository;
use ignore::WalkBuilder;
use rusqlite::{Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::Path;
use tauri::State;
use tracing::instrument;
use uuid::Uuid;
use walkdir::WalkDir;

/// Internal helper to fetch projects with git status
///
/// Deduplicates the logic between get_projects and get_all_projects
fn fetch_projects_internal(
    conn: &Connection,
    scope_id: Option<&str>,
) -> Result<Vec<ProjectWithStatus>, String> {
    // Build query with optional scope filter
    let sql = if scope_id.is_some() {
        r#"
        SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
               p.default_branch, p.workspace_file, p.is_temp, p.is_pinned, p.group_id,
               p.notes, p.description, p.last_opened_at, 
               p.created_at, p.updated_at,
               g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
               g.last_checked_at, g.remote_url
        FROM projects p
        LEFT JOIN git_status_cache g ON p.id = g.project_id
        WHERE p.scope_id = ?1
        ORDER BY p.is_pinned DESC, p.is_temp DESC, p.last_opened_at DESC NULLS LAST, p.name ASC
        "#
    } else {
        r#"
        SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
               p.default_branch, p.workspace_file, p.is_temp, p.is_pinned, p.group_id,
               p.notes, p.description, p.last_opened_at, 
               p.created_at, p.updated_at,
               g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
               g.last_checked_at, g.remote_url
        FROM projects p
        LEFT JOIN git_status_cache g ON p.id = g.project_id
        ORDER BY p.is_pinned DESC, p.is_temp DESC, p.last_opened_at DESC NULLS LAST, p.name ASC
        "#
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    // Use different query methods based on whether we have a scope filter
    let projects: Vec<(Project, Option<GitStatusCache>)> = if let Some(sid) = scope_id {
        stmt.query_map([sid], parse_project_row)
    } else {
        stmt.query_map([], parse_project_row)
    }
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    // Get tags, links, group, and statistics for each project
    let mut result = Vec::with_capacity(projects.len());
    for (project, git_status) in projects {
        let tags = get_project_tags_internal(conn, &project.id)?;
        let links = get_project_links_internal(conn, &project.id)?;
        let group = if let Some(ref group_id) = project.group_id {
            get_project_group_internal(conn, group_id).ok().flatten()
        } else {
            None
        };
        result.push(ProjectWithStatus {
            project,
            tags,
            git_status,
            links,
            group,
            statistics: None, // Statistics are computed on-demand
        });
    }

    Ok(result)
}

/// Parse a row from the projects query into (Project, Option<GitStatusCache>)
fn parse_project_row(row: &rusqlite::Row) -> rusqlite::Result<(Project, Option<GitStatusCache>)> {
    let project = Project {
        id: row.get(0)?,
        scope_id: row.get(1)?,
        name: row.get(2)?,
        path: row.get(3)?,
        preferred_editor_id: row.get(4)?,
        default_branch: row.get(5)?,
        workspace_file: row.get(6)?,
        is_temp: row.get::<_, i32>(7)? != 0,
        is_pinned: row.get::<_, i32>(8).unwrap_or(0) != 0,
        group_id: row.get(9).ok().flatten(),
        notes: row.get(10).ok().flatten(),
        description: row.get(11).ok().flatten(),
        last_opened_at: row
            .get::<_, Option<String>>(12)?
            .and_then(|s| s.parse().ok()),
        created_at: row
            .get::<_, String>(13)?
            .parse()
            .unwrap_or_else(|_| Utc::now()),
        updated_at: row
            .get::<_, String>(14)?
            .parse()
            .unwrap_or_else(|_| Utc::now()),
    };

    let branch: Option<String> = row.get(15)?;
    let git_status = branch.map(|b| GitStatusCache {
        project_id: project.id.clone(),
        branch: Some(b),
        ahead: row.get(16).unwrap_or(0),
        behind: row.get(17).unwrap_or(0),
        has_uncommitted: row.get::<_, i32>(18).unwrap_or(0) != 0,
        has_untracked: row.get::<_, i32>(19).unwrap_or(0) != 0,
        last_checked_at: row
            .get::<_, Option<String>>(20)
            .ok()
            .flatten()
            .and_then(|s| s.parse().ok()),
        remote_url: row.get(21).ok().flatten(),
    });

    Ok((project, git_status))
}

#[tauri::command]
#[specta::specta]
#[instrument(skip(db), level = "debug")]
pub fn get_projects(db: State<Database>, scope_id: String) -> Result<Vec<ProjectWithStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    fetch_projects_internal(&conn, Some(&scope_id))
}

#[tauri::command]
#[specta::specta]
pub fn get_all_projects(db: State<Database>) -> Result<Vec<ProjectWithStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    fetch_projects_internal(&conn, None)
}

#[tauri::command]
#[specta::specta]
#[instrument(skip(db), level = "info")]
pub fn create_project(db: State<Database>, request: CreateProjectRequest) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    conn.execute(
        r#"
        INSERT INTO projects (id, scope_id, name, path, is_temp, is_pinned, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        (
            &id,
            &request.scope_id,
            &request.name,
            &request.path,
            request.is_temp.unwrap_or(false) as i32,
            0i32, // is_pinned defaults to false
            now.to_rfc3339(),
            now.to_rfc3339(),
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        scope_id: request.scope_id,
        name: request.name,
        path: request.path,
        preferred_editor_id: None,
        default_branch: None,
        workspace_file: None,
        is_temp: request.is_temp.unwrap_or(false),
        is_pinned: false,
        group_id: None,
        notes: None,
        description: None,
        last_opened_at: None,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
#[specta::specta]
pub fn update_project(
    db: State<Database>,
    id: String,
    name: Option<String>,
    preferred_editor_id: Option<String>,
    default_branch: Option<String>,
    workspace_file: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    let mut updates = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.to_rfc3339())];
    let mut param_idx = 2;

    if let Some(ref n) = name {
        updates.push(format!("name = ?{}", param_idx));
        params.push(Box::new(n.clone()));
        param_idx += 1;
    }
    if let Some(ref e) = preferred_editor_id {
        updates.push(format!("preferred_editor_id = ?{}", param_idx));
        params.push(Box::new(e.clone()));
        param_idx += 1;
    }
    if let Some(ref b) = default_branch {
        updates.push(format!("default_branch = ?{}", param_idx));
        params.push(Box::new(b.clone()));
        param_idx += 1;
    }
    if let Some(ref w) = workspace_file {
        updates.push(format!("workspace_file = ?{}", param_idx));
        params.push(Box::new(w.clone()));
        param_idx += 1;
    }

    let sql = format!(
        "UPDATE projects SET {} WHERE id = ?{}",
        updates.join(", "),
        param_idx
    );
    params.push(Box::new(id));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get a single project by ID
#[tauri::command]
#[specta::specta]
pub fn get_project(db: State<Database>, id: String) -> Result<ProjectWithStatus, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (project, git_status) = conn
        .query_row(
            r#"
            SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
                   p.default_branch, p.workspace_file, p.is_temp, p.is_pinned, p.group_id,
                   p.notes, p.description, p.last_opened_at, 
                   p.created_at, p.updated_at,
                   g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
                   g.last_checked_at, g.remote_url
            FROM projects p
            LEFT JOIN git_status_cache g ON p.id = g.project_id
            WHERE p.id = ?1
            "#,
            [&id],
            parse_project_row,
        )
        .map_err(|e| format!("Project not found: {}", e))?;

    let tags = get_project_tags_internal(&conn, &project.id)?;
    let links = get_project_links_internal(&conn, &project.id)?;
    let group = if let Some(ref group_id) = project.group_id {
        get_project_group_internal(&conn, group_id).ok().flatten()
    } else {
        None
    };

    Ok(ProjectWithStatus {
        project,
        tags,
        git_status,
        links,
        group,
        statistics: None,
    })
}

#[tauri::command]
#[specta::specta]
#[instrument(skip(db), level = "info")]
pub fn delete_project(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_project_with_folder(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get the project path first
    let path: String = conn
        .query_row(
            "SELECT path FROM projects WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Project not found: {}", e))?;

    // Delete from database
    conn.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    // Delete the folder
    let folder_path = std::path::Path::new(&path);
    if folder_path.exists() && folder_path.is_dir() {
        std::fs::remove_dir_all(folder_path)
            .map_err(|e| format!("Failed to delete folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn update_project_last_opened(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET last_opened_at = ?1, updated_at = ?1 WHERE id = ?2",
        (now.to_rfc3339(), &id),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn move_project_to_scope(
    db: State<Database>,
    project_id: String,
    new_scope_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET scope_id = ?1, is_temp = 0, updated_at = ?2 WHERE id = ?3",
        (&new_scope_id, now.to_rfc3339(), &project_id),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Move a project to a new scope, optionally moving the folder physically
#[tauri::command]
#[specta::specta]
pub fn move_project_to_scope_with_folder(
    db: State<Database>,
    project_id: String,
    new_scope_id: String,
    target_folder: Option<String>,
    folder_name: Option<String>,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    // Get current project path
    let project_path: String = conn
        .query_row(
            "SELECT path FROM projects WHERE id = ?1",
            [&project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Project not found: {}", e))?;

    let mut final_path = project_path.clone();

    // If target folder is provided, move the folder physically
    if let Some(target) = target_folder {
        let current_path = Path::new(&project_path);

        // Determine folder name (use provided or keep original)
        let name = folder_name.unwrap_or_else(|| {
            current_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("project")
                .to_string()
        });

        let new_path = Path::new(&target).join(&name);
        let new_path_str = new_path.to_str().ok_or("Invalid new path")?;

        // Check if source and destination are the same
        if current_path == new_path {
            // No need to move, just update scope
        } else {
            // Check if destination already exists
            if new_path.exists() {
                return Err(format!("Destination already exists: {}", new_path_str));
            }

            // Ensure target directory exists
            let target_dir = Path::new(&target);
            if !target_dir.exists() {
                std::fs::create_dir_all(target_dir)
                    .map_err(|e| format!("Failed to create target directory: {}", e))?;
            }

            // Move the folder
            std::fs::rename(&project_path, &new_path)
                .map_err(|e| format!("Failed to move folder: {}", e))?;

            final_path = new_path_str.to_string();
        }
    }

    // Update database with new scope and possibly new path
    conn.execute(
        "UPDATE projects SET scope_id = ?1, path = ?2, is_temp = 0, updated_at = ?3 WHERE id = ?4",
        (&new_scope_id, &final_path, now.to_rfc3339(), &project_id),
    )
    .map_err(|e| e.to_string())?;

    Ok(final_path)
}

// Project Tags
#[tauri::command]
#[specta::specta]
pub fn add_project_tag(db: State<Database>, project_id: String, tag: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT OR IGNORE INTO project_tags (id, project_id, tag) VALUES (?1, ?2, ?3)",
        (&id, &project_id, &tag),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn remove_project_tag(db: State<Database>, project_id: String, tag: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM project_tags WHERE project_id = ?1 AND tag = ?2",
        (&project_id, &tag),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// Folder scanning
#[tauri::command]
#[specta::specta]
pub fn scan_folder_for_projects(folder_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Invalid folder path: {}", folder_path));
    }

    let mut git_repos = Vec::new();

    // Walk the directory tree
    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(4)
        .into_iter()
        .filter_entry(|e| {
            // Skip hidden directories entirely (we check for .git manually)
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.')
        })
        .flatten()
    {
        if entry.file_type().is_dir() {
            let git_dir = entry.path().join(".git");
            if git_dir.exists() && git_dir.is_dir() {
                if let Some(path_str) = entry.path().to_str() {
                    git_repos.push(path_str.to_string());
                }
            }
        }
    }

    // Also check if the root folder itself is a git repo
    let root_git = path.join(".git");
    if root_git.exists() && root_git.is_dir() {
        if let Some(path_str) = path.to_str() {
            if !git_repos.contains(&path_str.to_string()) {
                git_repos.insert(0, path_str.to_string());
            }
        }
    }

    Ok(git_repos)
}

fn get_project_tags_internal(
    conn: &rusqlite::Connection,
    project_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT tag FROM project_tags WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

fn get_project_links_internal(
    conn: &rusqlite::Connection,
    project_id: &str,
) -> Result<Vec<ProjectLink>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, project_id, link_type, label, url, sort_order, created_at
            FROM project_links WHERE project_id = ?1 ORDER BY sort_order ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let links = stmt
        .query_map([project_id], |row| {
            Ok(ProjectLink {
                id: row.get(0)?,
                project_id: row.get(1)?,
                link_type: row.get(2)?,
                label: row.get(3)?,
                url: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row
                    .get::<_, String>(6)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(links)
}

fn get_project_group_internal(
    conn: &rusqlite::Connection,
    group_id: &str,
) -> Result<Option<ProjectGroup>, String> {
    let result = conn
        .query_row(
            r#"
            SELECT id, scope_id, name, color, sort_order, created_at
            FROM project_groups WHERE id = ?1
            "#,
            [group_id],
            |row| {
                Ok(ProjectGroup {
                    id: row.get(0)?,
                    scope_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3).ok().flatten(),
                    sort_order: row.get(4)?,
                    created_at: row
                        .get::<_, String>(5)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

// Project Links Commands

#[tauri::command]
#[specta::specta]
pub fn create_project_link(
    db: State<Database>,
    request: CreateProjectLinkRequest,
) -> Result<ProjectLink, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_create_project_link(
        &conn,
        &request.project_id,
        &request.link_type,
        &request.label,
        &request.url,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn delete_project_link(db: State<Database>, link_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_delete_project_link(&conn, &link_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_project_links(
    db: State<Database>,
    project_id: String,
) -> Result<Vec<ProjectLink>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_get_project_links(&conn, &project_id).map_err(|e| e.to_string())
}

// Project Groups Commands

#[tauri::command]
#[specta::specta]
pub fn create_project_group(
    db: State<Database>,
    request: CreateProjectGroupRequest,
) -> Result<ProjectGroup, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_create_project_group(
        &conn,
        &request.scope_id,
        &request.name,
        request.color.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn update_project_group(
    db: State<Database>,
    group_id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::db::repository::update_project_group(&conn, &group_id, name.as_deref(), color.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn delete_project_group(db: State<Database>, group_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_delete_project_group(&conn, &group_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_project_groups(
    db: State<Database>,
    scope_id: String,
) -> Result<Vec<ProjectGroup>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_get_project_groups(&conn, &scope_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn assign_project_to_group(
    db: State<Database>,
    project_id: String,
    group_id: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_assign_project_to_group(&conn, &project_id, group_id.as_deref()).map_err(|e| e.to_string())
}

// Project Commands

#[tauri::command]
#[specta::specta]
pub fn create_project_command(
    db: State<Database>,
    request: CreateProjectCommandRequest,
) -> Result<ProjectCommand, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_create_project_command(
        &conn,
        &request.project_id,
        &request.name,
        &request.command,
        request.description.as_deref(),
        request.working_directory.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn update_project_command(
    db: State<Database>,
    command_id: String,
    name: Option<String>,
    command: Option<String>,
    description: Option<String>,
    working_directory: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::db::repository::update_project_command(
        &conn,
        &command_id,
        name.as_deref(),
        command.as_deref(),
        description.as_deref(),
        working_directory.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn delete_project_command(db: State<Database>, command_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_delete_project_command(&conn, &command_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_project_commands(
    db: State<Database>,
    project_id: String,
) -> Result<Vec<ProjectCommand>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    repo_get_project_commands(&conn, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn execute_project_command(
    db: State<Database>,
    command_id: String,
    project_path: String,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let command = repo_get_project_command_by_id(&conn, &command_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Command not found".to_string())?;

    use std::process::Command;
    let working_dir = command
        .working_directory
        .as_ref()
        .map(|wd| Path::new(&project_path).join(wd))
        .unwrap_or_else(|| Path::new(&project_path).to_path_buf());

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command.command])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Failed to execute command: {}", e))?
    } else {
        Command::new("sh")
            .args(["-c", &command.command])
            .current_dir(&working_dir)
            .output()
            .map_err(|e| format!("Failed to execute command: {}", e))?
    };

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// Project Metadata Commands

#[tauri::command]
#[specta::specta]
pub fn update_project_notes(
    db: State<Database>,
    project_id: String,
    notes: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET notes = ?1, updated_at = ?2 WHERE id = ?3",
        (
            notes.as_deref(),
            now.to_rfc3339(),
            &project_id,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn update_project_description(
    db: State<Database>,
    project_id: String,
    description: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET description = ?1, updated_at = ?2 WHERE id = ?3",
        (
            description.as_deref(),
            now.to_rfc3339(),
            &project_id,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn pin_project(db: State<Database>, project_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET is_pinned = 1, updated_at = ?1 WHERE id = ?2",
        (now.to_rfc3339(), &project_id),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn unpin_project(db: State<Database>, project_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    conn.execute(
        "UPDATE projects SET is_pinned = 0, updated_at = ?1 WHERE id = ?2",
        (now.to_rfc3339(), &project_id),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// Project Statistics Command

#[tauri::command]
#[specta::specta]
pub fn get_project_statistics(
    project_path: String,
) -> Result<ProjectStatistics, String> {
    let path = Path::new(&project_path);
    
    // Initialize statistics with defaults
    let mut file_count: u64 = 0;
    let mut repo_size_bytes: u64 = 0;
    let mut commit_count: Option<u64> = None;
    let mut last_commit: Option<LastCommitInfo> = None;
    let mut languages: Vec<LanguageInfo> = Vec::new();
    let mut contributors: Vec<ContributorInfo> = Vec::new();

    // Calculate file count and repository size (respecting .gitignore)
    let mut language_bytes: HashMap<String, u64> = HashMap::new();
    
    if path.exists() {
        // Use ignore::WalkBuilder which automatically respects .gitignore files
        // It also respects .ignore, .git/info/exclude, and global gitignore files
        let walker = WalkBuilder::new(path)
            .hidden(false) // Include hidden files (but .gitignore will still filter them)
            .git_ignore(true) // Respect .gitignore files
            .git_exclude(true) // Respect .git/info/exclude
            .git_global(true) // Respect global gitignore
            .filter_entry(|entry| {
                // Explicitly exclude .git directory
                let path = entry.path();
                // Check if this is the .git directory itself
                if entry.file_name() == ".git" {
                    return false;
                }
                // Check if path contains .git directory (cross-platform)
                let path_str = path.to_string_lossy();
                !path_str.contains(".git/") && !path_str.contains(".git\\")
            })
            .build();

        for result in walker {
            let entry = match result {
                Ok(e) => e,
                Err(_) => continue,
            };

            let entry_path = entry.path();

            // Safety check: explicitly skip .git directory and its contents (cross-platform)
            let path_str = entry_path.to_string_lossy();
            if path_str.contains(".git/") 
                || path_str.contains(".git\\")
                || entry_path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n == ".git")
                    .unwrap_or(false)
            {
                continue;
            }

            // Skip directories
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                continue;
            }

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            if metadata.is_file() {
                // Skip git pack/index files and other git-related files
                if let Some(file_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                    if file_name.ends_with(".pack") 
                        || file_name.ends_with(".idx")
                        || file_name.ends_with(".bitmap")
                        || file_name.ends_with(".keep")
                        || (file_name.starts_with("pack-") && file_name.ends_with(".pack"))
                        || (file_name.starts_with("multi-pack-index"))
                    {
                        continue;
                    }
                }

                file_count += 1;
                let file_size = metadata.len();
                repo_size_bytes += file_size;

                // Analyze language by file extension
                if let Some(ext) = entry_path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    // Skip git-related and binary extensions that shouldn't be counted
                    if ext_str == "pack" 
                        || ext_str == "idx" 
                        || ext_str == "bitmap" 
                        || ext_str == "keep"
                        || ext_str == "lock"
                    {
                        continue;
                    }
                    let lang_name = get_language_name(&ext_str);
                    *language_bytes.entry(lang_name).or_insert(0) += file_size;
                } else {
                    // Files without extensions: skip binary/git files, count others as "Other"
                    if let Some(file_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                        // Skip git index and other binary files
                        if file_name != "Makefile" 
                            && file_name != "Dockerfile"
                            && !file_name.starts_with(".")
                        {
                            // Only count as "Other" if it's not a hidden file
                            *language_bytes.entry("Other".to_string()).or_insert(0) += file_size;
                        }
                    }
                }
            }
        }
    }

    // Convert language bytes to LanguageInfo
    let total_lang_bytes: u64 = language_bytes.values().sum();
    if total_lang_bytes > 0 {
        languages = language_bytes
            .into_iter()
            .map(|(name, bytes)| LanguageInfo {
                name,
                bytes,
                percentage: (bytes as f64 / total_lang_bytes as f64) * 100.0,
            })
            .collect();
        // Sort by bytes descending
        languages.sort_by(|a, b| b.bytes.cmp(&a.bytes));
        // Limit to top 10 languages
        languages.truncate(10);
    }

    // Get git statistics if it's a git repository
    if let Ok(repo) = Repository::open(path) {
        // Count commits
        let mut revwalk = match repo.revwalk() {
            Ok(rw) => rw,
            Err(_) => return Ok(ProjectStatistics {
                file_count: Some(file_count),
                repo_size_bytes: Some(repo_size_bytes),
                commit_count: None,
                last_commit: None,
                languages,
                contributors: Vec::new(),
            }),
        };

        // Set sorting to show newest first
        revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)
            .map_err(|e| format!("Failed to set revwalk sorting: {}", e))?;

        // Push HEAD
        if let Ok(head) = repo.head() {
            if let Some(oid) = head.target() {
                revwalk.push(oid).ok();
            }
        }

        // Count commits and collect contributor info
        let mut commit_count_val = 0u64;
        let mut contributor_map: HashMap<(String, String), u64> = HashMap::new();

        for oid in revwalk {
            let oid = match oid {
                Ok(o) => o,
                Err(_) => break,
            };

            let commit = match repo.find_commit(oid) {
                Ok(c) => c,
                Err(_) => continue,
            };

            commit_count_val += 1;

            // Get last commit info (first iteration)
            if commit_count_val == 1 {
                let author = commit.author();
                let name = author.name().unwrap_or("Unknown").to_string();
                let email = author.email().unwrap_or("unknown@example.com").to_string();
                let message = commit.message().unwrap_or("").trim().to_string();
                let hash = oid.to_string();
                let time = commit.time();
                let date = DateTime::from_timestamp(time.seconds(), 0)
                    .unwrap_or_else(Utc::now);

                last_commit = Some(LastCommitInfo {
                    hash,
                    message: message.lines().next().unwrap_or("").to_string(),
                    author: format!("{} <{}>", name, email),
                    date,
                });
            }

            // Count contributors
            let author = commit.author();
            let name = author.name().unwrap_or("Unknown").to_string();
            let email = author.email().unwrap_or("unknown@example.com").to_string();
            *contributor_map.entry((name.clone(), email.clone())).or_insert(0) += 1;
        }

        commit_count = Some(commit_count_val);

        // Convert contributor map to ContributorInfo
        contributors = contributor_map
            .into_iter()
            .map(|((name, email), commit_count)| ContributorInfo {
                name,
                email,
                commit_count,
            })
            .collect();
        // Sort by commit count descending
        contributors.sort_by(|a, b| b.commit_count.cmp(&a.commit_count));
        // Limit to top 20 contributors
        contributors.truncate(20);
    }

    Ok(ProjectStatistics {
        file_count: Some(file_count),
        repo_size_bytes: Some(repo_size_bytes),
        commit_count,
        last_commit,
        languages,
        contributors,
    })
}

/// Map file extension to language name
fn get_language_name(ext: &str) -> String {
    match ext {
        "rs" => "Rust".to_string(),
        "ts" | "tsx" | "cts" | "mts" => "TypeScript".to_string(),
        "js" | "jsx" | "mjs" | "cjs" => "JavaScript".to_string(),
        "py" => "Python".to_string(),
        "java" => "Java".to_string(),
        "go" => "Go".to_string(),
        "cpp" | "cc" | "cxx" | "hpp" => "C++".to_string(),
        "c" | "h" => "C".to_string(),
        "swift" => "Swift".to_string(),
        "kt" => "Kotlin".to_string(),
        "scala" => "Scala".to_string(),
        "php" => "PHP".to_string(),
        "rb" => "Ruby".to_string(),
        "sh" | "bash" | "zsh" => "Shell".to_string(),
        "ps1" => "PowerShell".to_string(),
        "sql" => "SQL".to_string(),
        "html" | "htm" => "HTML".to_string(),
        "css" | "scss" | "sass" | "less" => "CSS".to_string(),
        "json" => "JSON".to_string(),
        "xml" => "XML".to_string(),
        "yaml" | "yml" => "YAML".to_string(),
        "toml" => "TOML".to_string(),
        "md" | "markdown" => "Markdown".to_string(),
        "dockerfile" => "Dockerfile".to_string(),
        "makefile" | "mk" => "Makefile".to_string(),
        "cmake" => "CMake".to_string(),
        "vue" => "Vue".to_string(),
        "svelte" => "Svelte".to_string(),
        "dart" => "Dart".to_string(),
        "lua" => "Lua".to_string(),
        "r" => "R".to_string(),
        "matlab" | "m" => "MATLAB".to_string(),
        "pl" | "pm" => "Perl".to_string(),
        "hs" => "Haskell".to_string(),
        "ml" | "mli" => "OCaml".to_string(),
        "elm" => "Elm".to_string(),
        "ex" | "exs" => "Elixir".to_string(),
        "clj" | "cljs" | "cljc" => "Clojure".to_string(),
        "erl" | "hrl" => "Erlang".to_string(),
        "fs" | "fsi" | "fsx" => "F#".to_string(),
        "vb" | "vbnet" => "VB.NET".to_string(),
        "cs" => "C#".to_string(),
        "d" => "D".to_string(),
        "nim" => "Nim".to_string(),
        "zig" => "Zig".to_string(),
        "v" => "V".to_string(),
        "cr" => "Crystal".to_string(),
        "jl" => "Julia".to_string(),
        "exe" | "dll" | "so" | "dylib" => "Binary".to_string(),
        _ => {
            // Capitalize first letter for unknown extensions
            let mut chars = ext.chars();
            match chars.next() {
                None => "Other".to_string(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}
