//! Repository for project command-related database operations

use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};

use crate::db::models::ProjectCommand;
use crate::error::{PanagerError, Result};

/// Create a new project command
pub fn create_project_command(
    conn: &Connection,
    project_id: &str,
    name: &str,
    command: &str,
    description: Option<&str>,
    working_directory: Option<&str>,
) -> Result<ProjectCommand> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // Get max sort order
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM project_commands WHERE project_id = ?1",
            [project_id],
            |row| row.get(0),
        )
        .map_err(PanagerError::Database)?;

    conn.execute(
        r#"
        INSERT INTO project_commands (id, project_id, name, command, description, working_directory, sort_order, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        (
            &id,
            project_id,
            name,
            command,
            description,
            working_directory,
            max_order + 1,
            now.to_rfc3339(),
        ),
    )
    .map_err(PanagerError::Database)?;

    Ok(ProjectCommand {
        id,
        project_id: project_id.to_string(),
        name: name.to_string(),
        command: command.to_string(),
        description: description.map(|s| s.to_string()),
        working_directory: working_directory.map(|s| s.to_string()),
        sort_order: max_order + 1,
        created_at: now,
    })
}

/// Update a project command
pub fn update_project_command(
    conn: &Connection,
    command_id: &str,
    name: Option<&str>,
    command: Option<&str>,
    description: Option<&str>,
    working_directory: Option<&str>,
) -> Result<()> {
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(n) = name {
        updates.push("name = ?1".to_string());
        params.push(Box::new(n));
    }

    if let Some(c) = command {
        updates.push(format!("command = ?{}", params.len() + 1));
        params.push(Box::new(c));
    }

    if let Some(d) = description {
        updates.push(format!("description = ?{}", params.len() + 1));
        params.push(Box::new(d));
    }

    if let Some(wd) = working_directory {
        updates.push(format!("working_directory = ?{}", params.len() + 1));
        params.push(Box::new(wd));
    }

    if updates.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE project_commands SET {} WHERE id = ?{}",
        updates.join(", "),
        params.len() + 1
    );
    params.push(Box::new(command_id));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(PanagerError::Database)?;

    Ok(())
}

/// Delete a project command
pub fn delete_project_command(conn: &Connection, command_id: &str) -> Result<()> {
    conn.execute("DELETE FROM project_commands WHERE id = ?1", [command_id])
        .map_err(PanagerError::Database)?;
    Ok(())
}

/// Get all commands for a project
pub fn get_project_commands(conn: &Connection, project_id: &str) -> Result<Vec<ProjectCommand>> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, project_id, name, command, description, working_directory, sort_order, created_at
            FROM project_commands WHERE project_id = ?1 ORDER BY sort_order ASC
            "#,
        )
        .map_err(PanagerError::Database)?;

    let commands: Vec<ProjectCommand> = stmt
        .query_map([project_id], |row| {
            Ok(ProjectCommand {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                command: row.get(3)?,
                description: row.get(4).ok().flatten(),
                working_directory: row.get(5).ok().flatten(),
                sort_order: row.get(6)?,
                created_at: row
                    .get::<_, String>(7)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(PanagerError::Database)?
        .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()
        .map_err(PanagerError::Database)?;

    Ok(commands)
}

/// Get a project command by ID
pub fn get_project_command_by_id(
    conn: &Connection,
    command_id: &str,
) -> Result<Option<ProjectCommand>> {
    let result = conn
        .query_row(
            r#"
            SELECT id, project_id, name, command, description, working_directory, sort_order, created_at
            FROM project_commands WHERE id = ?1
            "#,
            [command_id],
            |row| {
                Ok(ProjectCommand {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    command: row.get(3)?,
                    description: row.get(4).ok().flatten(),
                    working_directory: row.get(5).ok().flatten(),
                    sort_order: row.get(6)?,
                    created_at: row
                        .get::<_, String>(7)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                })
            },
        )
        .optional()
        .map_err(PanagerError::Database)?;

    Ok(result)
}
