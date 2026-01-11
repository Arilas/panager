use crate::db::models::{CreateProjectRequest, GitStatusCache, Project, ProjectWithStatus};
use crate::db::Database;
use chrono::Utc;
use std::path::Path;
use tauri::State;
use uuid::Uuid;
use walkdir::WalkDir;

#[tauri::command]
pub fn get_projects(db: State<Database>, scope_id: String) -> Result<Vec<ProjectWithStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
                   p.is_temp, p.last_opened_at, p.created_at, p.updated_at,
                   g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
                   g.last_checked_at, g.remote_url
            FROM projects p
            LEFT JOIN git_status_cache g ON p.id = g.project_id
            WHERE p.scope_id = ?1
            ORDER BY p.last_opened_at DESC NULLS LAST, p.name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let projects: Vec<(Project, Option<GitStatusCache>)> = stmt
        .query_map([&scope_id], |row| {
            let project = Project {
                id: row.get(0)?,
                scope_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                preferred_editor_id: row.get(4)?,
                is_temp: row.get::<_, i32>(5)? != 0,
                last_opened_at: row
                    .get::<_, Option<String>>(6)?
                    .and_then(|s| s.parse().ok()),
                created_at: row
                    .get::<_, String>(7)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: row
                    .get::<_, String>(8)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            };

            let branch: Option<String> = row.get(9)?;
            let git_status = branch.map(|b| GitStatusCache {
                project_id: project.id.clone(),
                branch: Some(b),
                ahead: row.get(10).unwrap_or(0),
                behind: row.get(11).unwrap_or(0),
                has_uncommitted: row.get::<_, i32>(12).unwrap_or(0) != 0,
                has_untracked: row.get::<_, i32>(13).unwrap_or(0) != 0,
                last_checked_at: row
                    .get::<_, Option<String>>(14)
                    .ok()
                    .flatten()
                    .and_then(|s| s.parse().ok()),
                remote_url: row.get(15).ok().flatten(),
            });

            Ok((project, git_status))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Get tags for each project
    let mut result = Vec::new();
    for (project, git_status) in projects {
        let tags = get_project_tags_internal(&conn, &project.id)?;
        result.push(ProjectWithStatus {
            project,
            tags,
            git_status,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_all_projects(db: State<Database>) -> Result<Vec<ProjectWithStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT p.id, p.scope_id, p.name, p.path, p.preferred_editor_id,
                   p.is_temp, p.last_opened_at, p.created_at, p.updated_at,
                   g.branch, g.ahead, g.behind, g.has_uncommitted, g.has_untracked,
                   g.last_checked_at, g.remote_url
            FROM projects p
            LEFT JOIN git_status_cache g ON p.id = g.project_id
            ORDER BY p.last_opened_at DESC NULLS LAST, p.name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let projects: Vec<(Project, Option<GitStatusCache>)> = stmt
        .query_map([], |row| {
            let project = Project {
                id: row.get(0)?,
                scope_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                preferred_editor_id: row.get(4)?,
                is_temp: row.get::<_, i32>(5)? != 0,
                last_opened_at: row
                    .get::<_, Option<String>>(6)?
                    .and_then(|s| s.parse().ok()),
                created_at: row
                    .get::<_, String>(7)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: row
                    .get::<_, String>(8)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            };

            let branch: Option<String> = row.get(9)?;
            let git_status = branch.map(|b| GitStatusCache {
                project_id: project.id.clone(),
                branch: Some(b),
                ahead: row.get(10).unwrap_or(0),
                behind: row.get(11).unwrap_or(0),
                has_uncommitted: row.get::<_, i32>(12).unwrap_or(0) != 0,
                has_untracked: row.get::<_, i32>(13).unwrap_or(0) != 0,
                last_checked_at: row
                    .get::<_, Option<String>>(14)
                    .ok()
                    .flatten()
                    .and_then(|s| s.parse().ok()),
                remote_url: row.get(15).ok().flatten(),
            });

            Ok((project, git_status))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (project, git_status) in projects {
        let tags = get_project_tags_internal(&conn, &project.id)?;
        result.push(ProjectWithStatus {
            project,
            tags,
            git_status,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn create_project(db: State<Database>, request: CreateProjectRequest) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    conn.execute(
        r#"
        INSERT INTO projects (id, scope_id, name, path, is_temp, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        (
            &id,
            &request.scope_id,
            &request.name,
            &request.path,
            request.is_temp.unwrap_or(false) as i32,
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
        is_temp: request.is_temp.unwrap_or(false),
        last_opened_at: None,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_project(
    db: State<Database>,
    id: String,
    name: Option<String>,
    preferred_editor_id: Option<String>,
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

#[tauri::command]
pub fn delete_project(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
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
    {
        if let Ok(entry) = entry {
            if entry.file_type().is_dir() {
                let git_dir = entry.path().join(".git");
                if git_dir.exists() && git_dir.is_dir() {
                    if let Some(path_str) = entry.path().to_str() {
                        git_repos.push(path_str.to_string());
                    }
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
