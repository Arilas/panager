//! Repository health diagnostic rules.
//!
//! Rules in this group check for repository state issues:
//! - Unpushed commits
//! - Detached HEAD state
//! - Merge conflicts
//! - Diverged from remote

mod unpushed_commits;
mod detached_head;
mod merge_conflicts;
mod diverged_from_remote;

pub use unpushed_commits::UnpushedCommitsRule;
pub use detached_head::DetachedHeadRule;
pub use merge_conflicts::MergeConflictsRule;
pub use diverged_from_remote::DivergedFromRemoteRule;
