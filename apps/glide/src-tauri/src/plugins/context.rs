//! Plugin context - API for plugins to communicate with the host
//!
//! The PluginContext is passed to plugins on activation and provides
//! methods for reporting diagnostics, updating status bar, etc.

use tokio::sync::mpsc;

use super::types::{Diagnostic, PluginEvent, StatusBarItem};

/// Context passed to plugins for communication with the host
///
/// This is the primary API that plugins use to interact with the IDE.
/// It is Clone-able so plugins can store it and use it from multiple places.
#[derive(Clone)]
pub struct PluginContext {
    /// The plugin's unique identifier
    plugin_id: String,
    /// Channel to send events to the host
    event_sender: mpsc::UnboundedSender<PluginEvent>,
}

impl PluginContext {
    /// Create a new plugin context
    pub fn new(plugin_id: String, event_sender: mpsc::UnboundedSender<PluginEvent>) -> Self {
        Self {
            plugin_id,
            event_sender,
        }
    }

    /// Get the plugin's unique identifier
    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    /// Report diagnostics for a file
    ///
    /// This replaces any existing diagnostics from this plugin for the given file.
    /// To clear diagnostics, pass an empty vector or use `clear_diagnostics`.
    ///
    /// # Example
    /// ```ignore
    /// ctx.report_diagnostics("/path/to/file.ts".to_string(), vec![
    ///     Diagnostic {
    ///         id: "1".to_string(),
    ///         file_path: "/path/to/file.ts".to_string(),
    ///         severity: DiagnosticSeverity::Error,
    ///         message: "Type 'string' is not assignable to type 'number'".to_string(),
    ///         source: "TypeScript".to_string(),
    ///         code: Some("2322".to_string()),
    ///         start_line: 10,
    ///         start_column: 5,
    ///         end_line: 10,
    ///         end_column: 15,
    ///     }
    /// ]);
    /// ```
    pub fn report_diagnostics(&self, file_path: String, diagnostics: Vec<Diagnostic>) {
        let _ = self.event_sender.send(PluginEvent::DiagnosticsUpdated {
            plugin_id: self.plugin_id.clone(),
            file_path,
            diagnostics,
        });
    }

    /// Clear diagnostics for a specific file or all files
    ///
    /// # Arguments
    /// * `file_path` - If Some, clear diagnostics only for that file. If None, clear all.
    pub fn clear_diagnostics(&self, file_path: Option<String>) {
        let _ = self.event_sender.send(PluginEvent::DiagnosticsCleared {
            plugin_id: self.plugin_id.clone(),
            file_path,
        });
    }

    /// Update or create a status bar item
    ///
    /// If an item with the same ID already exists, it will be updated.
    ///
    /// # Example
    /// ```ignore
    /// ctx.update_status_bar(StatusBarItem {
    ///     id: "ts-version".to_string(),
    ///     text: "TS 5.3.0".to_string(),
    ///     tooltip: Some("TypeScript Version".to_string()),
    ///     alignment: StatusBarAlignment::Right,
    ///     priority: 50,
    /// });
    /// ```
    pub fn update_status_bar(&self, item: StatusBarItem) {
        let _ = self.event_sender.send(PluginEvent::StatusBarUpdated {
            plugin_id: self.plugin_id.clone(),
            item,
        });
    }

    /// Remove a status bar item
    pub fn remove_status_bar(&self, item_id: String) {
        let _ = self.event_sender.send(PluginEvent::StatusBarRemoved {
            plugin_id: self.plugin_id.clone(),
            item_id,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::types::DiagnosticSeverity;

    #[tokio::test]
    async fn test_context_sends_diagnostics() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let ctx = PluginContext::new("test.plugin".to_string(), tx);

        ctx.report_diagnostics(
            "/test/file.ts".to_string(),
            vec![Diagnostic {
                id: "1".to_string(),
                file_path: "/test/file.ts".to_string(),
                severity: DiagnosticSeverity::Error,
                message: "Test error".to_string(),
                source: "Test".to_string(),
                code: None,
                start_line: 1,
                start_column: 1,
                end_line: 1,
                end_column: 10,
            }],
        );

        let event = rx.recv().await.expect("Should receive event");
        match event {
            PluginEvent::DiagnosticsUpdated {
                plugin_id,
                file_path,
                diagnostics,
            } => {
                assert_eq!(plugin_id, "test.plugin");
                assert_eq!(file_path, "/test/file.ts");
                assert_eq!(diagnostics.len(), 1);
            }
            _ => panic!("Expected DiagnosticsUpdated event"),
        }
    }
}
