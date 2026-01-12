//! Event handlers for processing application events.
//!
//! Each handler subscribes to the event bus and processes events it cares about.
//! Handlers run in their own async tasks and should be non-blocking.

pub mod diagnostics;
pub mod frontend;
