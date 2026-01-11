//! Repository for settings-related database operations

use rusqlite::Connection;
use std::collections::HashMap;

use crate::error::{PanagerError, Result};

/// Get a single setting value
///
/// # Arguments
/// * `conn` - Database connection
/// * `key` - The setting key
///
/// # Returns
/// The setting value as JSON, or None if not found
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<serde_json::Value>> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .ok();

    match value {
        Some(v) => serde_json::from_str(&v)
            .map(Some)
            .map_err(PanagerError::Json),
        None => Ok(None),
    }
}

/// Set a setting value
///
/// # Arguments
/// * `conn` - Database connection
/// * `key` - The setting key
/// * `value` - The setting value as JSON
pub fn set_setting(conn: &Connection, key: &str, value: &serde_json::Value) -> Result<()> {
    let value_str = serde_json::to_string(value).map_err(PanagerError::Json)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        r#"
        INSERT INTO settings (key, value, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3
        "#,
        rusqlite::params![key, value_str, now],
    )
    .map_err(PanagerError::Database)?;

    Ok(())
}

/// Get all settings as a HashMap
///
/// # Arguments
/// * `conn` - Database connection
///
/// # Returns
/// HashMap of setting key-value pairs
pub fn get_all_settings(conn: &Connection) -> Result<HashMap<String, serde_json::Value>> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(PanagerError::Database)?;

    let settings: HashMap<String, serde_json::Value> = stmt
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value_str: String = row.get(1)?;
            Ok((key, value_str))
        })
        .map_err(PanagerError::Database)?
        .filter_map(|r| r.ok())
        .filter_map(|(key, value_str)| {
            serde_json::from_str(&value_str)
                .ok()
                .map(|value| (key, value))
        })
        .collect();

    Ok(settings)
}

/// Delete a setting
///
/// # Arguments
/// * `conn` - Database connection
/// * `key` - The setting key
pub fn delete_setting(conn: &Connection, key: &str) -> Result<()> {
    conn.execute("DELETE FROM settings WHERE key = ?1", [key])
        .map_err(PanagerError::Database)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_get_setting_not_found() {
        let conn = setup_test_db();
        let result = get_setting(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_set_and_get_setting() {
        let conn = setup_test_db();

        let value = serde_json::json!({"theme": "dark"});
        set_setting(&conn, "preferences", &value).unwrap();

        let result = get_setting(&conn, "preferences").unwrap();
        assert_eq!(result, Some(value));
    }

    #[test]
    fn test_get_all_settings_empty() {
        let conn = setup_test_db();
        let result = get_all_settings(&conn).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_set_and_get_all_settings() {
        let conn = setup_test_db();

        set_setting(&conn, "key1", &serde_json::json!("value1")).unwrap();
        set_setting(&conn, "key2", &serde_json::json!(42)).unwrap();

        let result = get_all_settings(&conn).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result.get("key1"), Some(&serde_json::json!("value1")));
        assert_eq!(result.get("key2"), Some(&serde_json::json!(42)));
    }
}
