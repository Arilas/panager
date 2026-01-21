//! Frontend event forwarder.
//!
//! This handler forwards application events to the Tauri event system
//! so the frontend can react to state changes.

use crate::events::AppEvent;
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

/// The event name used for forwarding events to the frontend.
pub const FRONTEND_EVENT_NAME: &str = "app-event";

/// Start the frontend event forwarder.
///
/// This handler listens to all events from the event bus and forwards them
/// to the Tauri event system using the "app-event" event name.
///
/// The frontend can listen to this event to react to all application state changes.
pub fn start_handler(app_handle: AppHandle, mut receiver: broadcast::Receiver<AppEvent>) {
    tracing::debug!("Starting frontend event forwarder");

    tauri::async_runtime::spawn(async move {
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    // Forward to frontend via Tauri events
                    if let Err(e) = app_handle.emit(FRONTEND_EVENT_NAME, &event) {
                        tracing::warn!("Failed to emit event to frontend: {}", e);
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!(
                        "Frontend event forwarder lagged {} events - some UI updates may be missed",
                        n
                    );
                }
                Err(broadcast::error::RecvError::Closed) => {
                    tracing::info!("Event bus closed, stopping frontend forwarder");
                    break;
                }
            }
        }
    });
}
