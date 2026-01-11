use crate::db::Database;
use chrono::Utc;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_setting(db: State<Database>, key: String) -> Result<Option<serde_json::Value>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let value: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [&key], |row| {
            row.get(0)
        })
        .ok();

    match value {
        Some(v) => serde_json::from_str(&v)
            .map(Some)
            .map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub fn set_setting(
    db: State<Database>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    let value_str = serde_json::to_string(&value).map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?1, ?2, ?3)
        "#,
        (&key, &value_str, now.to_rfc3339()),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_all_settings(db: State<Database>) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let settings: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = std::collections::HashMap::new();
    for (key, value) in settings {
        if let Ok(parsed) = serde_json::from_str(&value) {
            result.insert(key, parsed);
        }
    }

    Ok(result)
}
