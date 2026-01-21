//! Event bus system for decoupled communication between app components.
//!
//! The event bus allows commands and services to emit events without knowing
//! about the consumers. This enables:
//! - Decoupling between components
//! - Easy addition of new event handlers
//! - Testable event flows
//! - Consistent patterns for cross-cutting concerns
//!
//! # Example
//!
//! ```rust,ignore
//! // In a command:
//! event_bus.emit(AppEvent::ProjectAdded {
//!     project_id: project.id.clone(),
//!     scope_id: project.scope_id.clone(),
//! });
//!
//! // The diagnostics handler will automatically scan the new project
//! // The frontend handler will notify the UI to refresh
//! ```

pub mod handlers;
pub mod types;

pub use types::AppEvent;

use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast;

/// Capacity of the event channel.
/// Events beyond this will cause receivers to lag.
const CHANNEL_CAPACITY: usize = 256;

/// The central event bus for application-wide event distribution.
///
/// Uses a broadcast channel to allow multiple subscribers to receive
/// all events. Events are fire-and-forget - emitting never blocks.
pub struct EventBus {
    sender: broadcast::Sender<AppEvent>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBus {
    /// Create a new event bus.
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
        Self { sender }
    }

    /// Emit an event to all subscribers.
    ///
    /// This is non-blocking and will not fail even if there are no subscribers.
    /// Events are logged at trace level for debugging.
    pub fn emit(&self, event: AppEvent) {
        tracing::trace!("Event emitted: {}", event.description());
        // Ignore send errors - it's fine if no one is listening
        let _ = self.sender.send(event);
    }

    /// Subscribe to events.
    ///
    /// Returns a receiver that will receive all events emitted after subscription.
    /// If the receiver falls behind by more than CHANNEL_CAPACITY events,
    /// it will receive a Lagged error with the number of skipped events.
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.sender.subscribe()
    }

    /// Get the number of active subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

/// Initialize and start all event handlers.
///
/// This should be called during app startup after the EventBus is registered
/// in app state. Each handler runs in its own async task.
pub fn start_event_handlers(app_handle: AppHandle) {
    let event_bus = match app_handle.try_state::<EventBus>() {
        Some(bus) => bus,
        None => {
            tracing::error!("EventBus not found in app state - cannot start handlers");
            return;
        }
    };

    tracing::info!("Starting event handlers...");

    // Frontend forwarder - forwards events to the Tauri event system for UI
    handlers::frontend::start_handler(app_handle.clone(), event_bus.subscribe());

    // Diagnostics handler - triggers scans when relevant events occur
    handlers::diagnostics::start_handler(app_handle.clone(), event_bus.subscribe());

    tracing::info!("Event handlers started");
}

/// Helper trait for easily emitting events from anywhere with access to AppHandle.
pub trait EventEmitter {
    /// Emit an event through the event bus.
    fn emit_event(&self, event: AppEvent);
}

impl EventEmitter for AppHandle {
    fn emit_event(&self, event: AppEvent) {
        if let Some(event_bus) = self.try_state::<EventBus>() {
            event_bus.emit(event);
        } else {
            tracing::warn!("EventBus not available, event dropped: {}", event.description());
        }
    }
}

/// Extension trait for Arc<EventBus> to simplify event emission.
impl EventEmitter for Arc<EventBus> {
    fn emit_event(&self, event: AppEvent) {
        self.emit(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    #[tokio::test]
    async fn test_event_bus_emit_and_receive() {
        let bus = EventBus::new();
        let mut receiver = bus.subscribe();

        bus.emit(AppEvent::ScopeCreated {
            scope_id: "test-scope".to_string(),
        });

        let result = timeout(Duration::from_millis(100), receiver.recv()).await;
        assert!(result.is_ok());

        let event = result.unwrap().unwrap();
        match event {
            AppEvent::ScopeCreated { scope_id } => {
                assert_eq!(scope_id, "test-scope");
            }
            _ => panic!("Unexpected event type"),
        }
    }

    #[tokio::test]
    async fn test_event_bus_multiple_subscribers() {
        let bus = EventBus::new();
        let mut receiver1 = bus.subscribe();
        let mut receiver2 = bus.subscribe();

        bus.emit(AppEvent::ScopeCreated {
            scope_id: "test-scope".to_string(),
        });

        // Both receivers should get the event
        let result1 = timeout(Duration::from_millis(100), receiver1.recv()).await;
        let result2 = timeout(Duration::from_millis(100), receiver2.recv()).await;

        assert!(result1.is_ok());
        assert!(result2.is_ok());
    }

    #[test]
    fn test_event_bus_subscriber_count() {
        let bus = EventBus::new();
        assert_eq!(bus.subscriber_count(), 0);

        let _receiver1 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 1);

        let _receiver2 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 2);
    }
}
