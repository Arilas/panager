//! IDE Database Module
//!
//! Provides per-project SQLite database for storing:
//! - Chat sessions and entries (unified entry architecture)
//! - Tabs and tab groups (unified tab management)
//!
//! Each project has its own `.glide/` directory with a SQLite database.

pub mod chat;
pub mod migrations;
pub mod tabs;

pub use chat::{
    ChatDb, DbEntry, DbSession, DbSessionInfo, DbSessionWithEntries, EntryType,
};
pub use migrations::run_migrations;
pub use tabs::{DbTab, DbTabGroup, DbTabSession, TabsDb};
