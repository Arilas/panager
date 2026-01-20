//! IDE Database Module
//!
//! Provides per-project SQLite database for storing chat sessions and entries.
//! Each project has its own `.panager/` directory with a SQLite database.
//!
//! Uses a unified "entry" architecture where all chat items (messages, tool calls,
//! permission requests, meta) are stored in a single entries table with a type field.
//! See plan file "Entry Processing Rules" for shared logic between backend and frontend.

pub mod chat;
pub mod migrations;

pub use chat::{
    ChatDb, DbEntry, DbSession, DbSessionInfo, DbSessionWithEntries, EntryType,
};
pub use migrations::run_migrations;
