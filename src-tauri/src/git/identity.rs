//! Git identity management
//!
//! This module provides functionality for reading and managing git identities
//! associated with scopes. It consolidates duplicate identity logic from
//! multiple modules into a single source of truth.

use crate::db::Database;

/// Git identity for a scope (user name and email)
#[derive(Debug, Clone)]
pub struct GitIdentity {
    pub user_name: String,
    pub user_email: String,
}

/// Get the cached git identity for a scope from the database
///
/// This is a lightweight query that only returns the cached identity,
/// without triggering any file system reads or cache updates.
///
/// # Arguments
/// * `db` - Database reference
/// * `scope_id` - The scope ID to look up
///
/// # Returns
/// * `Some(GitIdentity)` if a cached identity exists
/// * `None` if no identity is cached for this scope
pub fn get_cached_git_identity(db: &Database, scope_id: &str) -> Option<GitIdentity> {
    let conn = db.conn.lock().ok()?;
    let result: Result<(String, String), _> = conn.query_row(
        "SELECT user_name, user_email FROM scope_git_config WHERE scope_id = ?1 AND user_name IS NOT NULL AND user_email IS NOT NULL",
        [scope_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );
    result.ok().map(|(user_name, user_email)| GitIdentity {
        user_name,
        user_email,
    })
}

/// Get the git identity for a scope, returning just the name and email tuple
///
/// This is a convenience wrapper for code that needs the identity as a tuple.
///
/// # Arguments
/// * `db` - Database reference
/// * `scope_id` - The scope ID to look up
///
/// # Returns
/// * `Some((name, email))` if a cached identity exists
/// * `None` if no identity is cached for this scope
pub fn get_scope_git_identity_tuple(db: &Database, scope_id: &str) -> Option<(String, String)> {
    get_cached_git_identity(db, scope_id).map(|id| (id.user_name, id.user_email))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_identity_struct() {
        let identity = GitIdentity {
            user_name: "Test User".to_string(),
            user_email: "test@example.com".to_string(),
        };
        assert_eq!(identity.user_name, "Test User");
        assert_eq!(identity.user_email, "test@example.com");
    }
}
