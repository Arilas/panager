pub mod migrations;
pub mod models;
pub mod queries;
pub mod repository;
pub mod schema;

// Re-export for convenience
pub use models::*;
pub use queries::*;
pub use repository::*;

use directories::ProjectDirs;
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = get_database_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // Initialize schema (creates tables if they don't exist)
        schema::init_database(&conn)?;

        // Run migrations for schema updates
        migrations::run_migrations(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Get a setting value from the database
    pub fn get_setting(&self, key: &str) -> Result<Option<serde_json::Value>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let result: Result<String, _> = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );

        match result {
            Ok(value_str) => {
                let value: serde_json::Value = serde_json::from_str(&value_str)
                    .unwrap_or(serde_json::Value::Null);
                Ok(Some(value))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

fn get_database_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let proj_dirs = ProjectDirs::from("com", "krona", "panager")
        .ok_or("Failed to determine project directories")?;

    let data_dir = proj_dirs.data_dir();
    Ok(data_dir.join("panager.db"))
}

/// Create an in-memory database for testing
///
/// This creates a fully initialized database with schema and migrations
/// applied, useful for unit tests.
#[cfg(test)]
pub fn create_test_database() -> Database {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory database");

    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .expect("Failed to enable foreign keys");

    // Initialize schema
    schema::init_database(&conn).expect("Failed to initialize schema");

    // Run migrations
    migrations::run_migrations(&conn).expect("Failed to run migrations");

    Database {
        conn: Mutex::new(conn),
    }
}
