//! Git-related diagnostic rules.
//!
//! Rules in this group check for git configuration issues:
//! - Identity mismatches (name, email)
//! - GPG signing configuration
//! - SSH remote URL configuration
//! - Missing or incomplete identity

mod identity_mismatch;
mod gpg_mismatch;
mod ssh_remote_mismatch;
mod missing_identity;
mod incomplete_identity_for_gpg;

pub use identity_mismatch::IdentityMismatchRule;
pub use gpg_mismatch::GpgMismatchRule;
pub use ssh_remote_mismatch::SshRemoteMismatchRule;
pub use missing_identity::MissingIdentityRule;
pub use incomplete_identity_for_gpg::IncompleteIdentityForGpgRule;
