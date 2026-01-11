//! State management for the folder scanner service

use std::sync::Arc;
use tokio::sync::Mutex;

/// State to track if folder scan service is running
pub struct FolderScanServiceState {
    pub running: Arc<Mutex<bool>>,
}

impl Default for FolderScanServiceState {
    fn default() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }
}
