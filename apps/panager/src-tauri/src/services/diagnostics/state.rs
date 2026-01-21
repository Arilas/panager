//! Diagnostics service state management.

use std::sync::Arc;
use tokio::sync::Mutex;

/// State for the diagnostics background service.
#[derive(Default)]
pub struct DiagnosticsServiceState {
    /// Whether the service is currently running
    pub running: Arc<Mutex<bool>>,
    /// Whether a scan is currently in progress
    pub scanning: Arc<Mutex<bool>>,
}
