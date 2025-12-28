use crate::db::models::{CreateScopeRequest, Scope, ScopeLink, ScopeWithLinks, CreateScopeLinkRequest};
use crate::db::Database;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_scopes(db: State<Database>) -> Result<Vec<ScopeWithLinks>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, color, icon, default_editor_id, settings, sort_order, created_at, updated_at
            FROM scopes ORDER BY sort_order ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let scopes: Vec<Scope> = stmt
        .query_map([], |row| {
            Ok(Scope {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                default_editor_id: row.get(4)?,
                settings: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                sort_order: row.get(6)?,
                created_at: row
                    .get::<_, String>(7)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: row
                    .get::<_, String>(8)?
                    .parse()
                    .unwrap_or_else(|_| Utc::now()),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Get links for each scope
    let mut result = Vec::new();
    for scope in scopes {
        let links = get_scope_links_internal(&conn, &scope.id)?;
        result.push(ScopeWithLinks { scope, links });
    }

    Ok(result)
}

#[tauri::command]
pub fn create_scope(db: State<Database>, request: CreateScopeRequest) -> Result<Scope, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Get next sort order
    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM scopes", [], |row| {
            row.get(0)
        })
        .unwrap_or(-1);

    conn.execute(
        r#"
        INSERT INTO scopes (id, name, color, icon, sort_order, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        (
            &id,
            &request.name,
            &request.color,
            &request.icon,
            max_order + 1,
            now.to_rfc3339(),
            now.to_rfc3339(),
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(Scope {
        id,
        name: request.name,
        color: request.color,
        icon: request.icon,
        default_editor_id: None,
        settings: None,
        sort_order: max_order + 1,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_scope(
    db: State<Database>,
    id: String,
    name: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    default_editor_id: Option<String>,
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
    if let Some(ref c) = color {
        updates.push(format!("color = ?{}", param_idx));
        params.push(Box::new(c.clone()));
        param_idx += 1;
    }
    if let Some(ref i) = icon {
        updates.push(format!("icon = ?{}", param_idx));
        params.push(Box::new(i.clone()));
        param_idx += 1;
    }
    if let Some(ref e) = default_editor_id {
        updates.push(format!("default_editor_id = ?{}", param_idx));
        params.push(Box::new(e.clone()));
        param_idx += 1;
    }

    let sql = format!(
        "UPDATE scopes SET {} WHERE id = ?{}",
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
pub fn delete_scope(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM scopes WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn reorder_scopes(db: State<Database>, scope_ids: Vec<String>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    for (idx, id) in scope_ids.iter().enumerate() {
        conn.execute(
            "UPDATE scopes SET sort_order = ?1 WHERE id = ?2",
            (idx as i32, id),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Scope Links
#[tauri::command]
pub fn create_scope_link(
    db: State<Database>,
    request: CreateScopeLinkRequest,
) -> Result<ScopeLink, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM scope_links WHERE scope_id = ?1",
            [&request.scope_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        r#"
        INSERT INTO scope_links (id, scope_id, link_type, label, url, sort_order, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        (
            &id,
            &request.scope_id,
            &request.link_type,
            &request.label,
            &request.url,
            max_order + 1,
            now.to_rfc3339(),
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(ScopeLink {
        id,
        scope_id: request.scope_id,
        link_type: request.link_type,
        label: request.label,
        url: request.url,
        sort_order: max_order + 1,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_scope_link(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM scope_links WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn get_scope_links_internal(
    conn: &rusqlite::Connection,
    scope_id: &str,
) -> Result<Vec<ScopeLink>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, scope_id, link_type, label, url, sort_order, created_at
            FROM scope_links WHERE scope_id = ?1 ORDER BY sort_order ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let links = stmt
        .query_map([scope_id], |row| {
            Ok(ScopeLink {
                id: row.get(0)?,
                scope_id: row.get(1)?,
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
