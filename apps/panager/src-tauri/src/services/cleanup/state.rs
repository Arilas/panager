//! State management for the cleanup service

use std::sync::Arc;
use tokio::sync::Mutex;

/// State to track if cleanup service is running
pub struct CleanupServiceState {
    pub running: Arc<Mutex<bool>>,
}

impl Default for CleanupServiceState {
    fn default() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }
}
