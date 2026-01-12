//! Project structure diagnostic rules.
//!
//! Rules in this group check for project organization issues:
//! - Project outside scope's default folder
//! - Missing .gitignore file
//! - Empty repository

mod outside_folder;
mod missing_gitignore;
mod empty_repository;

pub use outside_folder::OutsideFolderRule;
pub use missing_gitignore::MissingGitignoreRule;
pub use empty_repository::EmptyRepositoryRule;
