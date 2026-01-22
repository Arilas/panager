//! Plugin Host - Manages plugin lifecycle and event routing
//!
//! The PluginHost is the central coordinator for all plugins. It:
//! - Registers and tracks plugins
//! - Manages plugin activation/deactivation
//! - Routes events between plugins and the frontend
//! - Broadcasts host events to relevant plugins

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tauri::{AppHandle, Emitter};
use tracing::{debug, error, info, warn};

use std::path::PathBuf;

use super::context::PluginContext;
use super::types::{
    HostEvent, LspCodeAction, LspCompletionList, LspDocumentHighlight, LspDocumentSymbol,
    LspFoldingRange, LspFormattingOptions, LspHover, LspInlayHint, LspLinkedEditingRanges,
    LspLocation, LspPosition, LspSelectionRange, LspSignatureHelp, LspTextEdit, LspWorkspaceEdit,
    Plugin, PluginEvent, PluginManifest, PluginState,
};

/// A registered plugin instance with its state
pub struct PluginInstance {
    /// Plugin metadata
    pub manifest: PluginManifest,
    /// Current state
    pub state: PluginState,
    /// Error message if state is Error
    pub error: Option<String>,
    /// The actual plugin implementation
    plugin: Box<dyn Plugin>,
}

/// The plugin host manages all plugins and their lifecycle
pub struct PluginHost {
    /// All registered plugins, keyed by plugin ID
    plugins: RwLock<HashMap<String, PluginInstance>>,
    /// Channel sender for plugin events
    event_sender: mpsc::UnboundedSender<PluginEvent>,
    /// Channel receiver for plugin events (taken on start)
    event_receiver: RwLock<Option<mpsc::UnboundedReceiver<PluginEvent>>>,
    /// Tauri app handle for emitting events to frontend
    app_handle: RwLock<Option<AppHandle>>,
}

impl PluginHost {
    /// Create a new plugin host
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            plugins: RwLock::new(HashMap::new()),
            event_sender: tx,
            event_receiver: RwLock::new(Some(rx)),
            app_handle: RwLock::new(None),
        }
    }

    /// Set the Tauri app handle for event emission
    pub async fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write().await = Some(handle);
    }

    /// Register a plugin (does not activate it)
    pub async fn register(&self, plugin: Box<dyn Plugin>) {
        let manifest = plugin.manifest().clone();
        let id = manifest.id.clone();

        info!("Registering plugin: {} v{}", manifest.name, manifest.version);

        let instance = PluginInstance {
            manifest,
            state: PluginState::Inactive,
            error: None,
            plugin,
        };

        self.plugins.write().await.insert(id, instance);
    }

    /// Activate a plugin by ID
    pub async fn activate(&self, plugin_id: &str) -> Result<(), String> {
        info!("Activating plugin: {}", plugin_id);

        // Check if plugin exists and get its current state
        {
            let plugins = self.plugins.read().await;
            let instance = plugins
                .get(plugin_id)
                .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

            if instance.state == PluginState::Active {
                debug!("Plugin {} is already active", plugin_id);
                return Ok(());
            }

            if instance.state == PluginState::Activating {
                return Err(format!("Plugin {} is already activating", plugin_id));
            }
        }

        // Update state to activating
        {
            let mut plugins = self.plugins.write().await;
            if let Some(instance) = plugins.get_mut(plugin_id) {
                instance.state = PluginState::Activating;
                instance.error = None;
            }
        }
        self.emit_state_change(plugin_id, PluginState::Activating, None);

        // Create context and activate
        let ctx = PluginContext::new(plugin_id.to_string(), self.event_sender.clone());

        let result = {
            let mut plugins = self.plugins.write().await;
            let instance = plugins
                .get_mut(plugin_id)
                .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

            instance.plugin.activate(ctx).await
        };

        // Update state based on result
        match result {
            Ok(()) => {
                let mut plugins = self.plugins.write().await;
                if let Some(instance) = plugins.get_mut(plugin_id) {
                    instance.state = PluginState::Active;
                    instance.error = None;
                }
                self.emit_state_change(plugin_id, PluginState::Active, None);
                info!("Plugin {} activated successfully", plugin_id);
                Ok(())
            }
            Err(e) => {
                let mut plugins = self.plugins.write().await;
                if let Some(instance) = plugins.get_mut(plugin_id) {
                    instance.state = PluginState::Error;
                    instance.error = Some(e.clone());
                }
                self.emit_state_change(plugin_id, PluginState::Error, Some(e.clone()));
                error!("Plugin {} failed to activate: {}", plugin_id, e);
                Err(e)
            }
        }
    }

    /// Deactivate a plugin by ID
    pub async fn deactivate(&self, plugin_id: &str) -> Result<(), String> {
        info!("Deactivating plugin: {}", plugin_id);

        // Check current state
        {
            let plugins = self.plugins.read().await;
            let instance = plugins
                .get(plugin_id)
                .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

            if instance.state != PluginState::Active {
                debug!("Plugin {} is not active, skipping deactivation", plugin_id);
                return Ok(());
            }
        }

        // Update state to deactivating
        {
            let mut plugins = self.plugins.write().await;
            if let Some(instance) = plugins.get_mut(plugin_id) {
                instance.state = PluginState::Deactivating;
            }
        }
        self.emit_state_change(plugin_id, PluginState::Deactivating, None);

        // Deactivate the plugin
        let result = {
            let mut plugins = self.plugins.write().await;
            let instance = plugins
                .get_mut(plugin_id)
                .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

            instance.plugin.deactivate().await
        };

        // Update state
        {
            let mut plugins = self.plugins.write().await;
            if let Some(instance) = plugins.get_mut(plugin_id) {
                instance.state = PluginState::Inactive;
                instance.error = None;
            }
        }
        self.emit_state_change(plugin_id, PluginState::Inactive, None);

        if let Err(e) = result {
            warn!("Plugin {} deactivation had errors: {}", plugin_id, e);
        }

        info!("Plugin {} deactivated", plugin_id);
        Ok(())
    }

    /// Restart a plugin by ID (deactivate then activate)
    pub async fn restart(&self, plugin_id: &str) -> Result<(), String> {
        info!("Restarting plugin: {}", plugin_id);

        // First deactivate if active
        {
            let plugins = self.plugins.read().await;
            if let Some(instance) = plugins.get(plugin_id) {
                if instance.state == PluginState::Active {
                    drop(plugins);
                    self.deactivate(plugin_id).await?;
                }
            } else {
                return Err(format!("Plugin not found: {}", plugin_id));
            }
        }

        // Small delay to ensure clean shutdown
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Then activate
        self.activate(plugin_id).await?;

        info!("Plugin {} restarted successfully", plugin_id);
        Ok(())
    }

    /// Broadcast a host event to all active plugins
    ///
    /// If `language` is provided, only plugins supporting that language receive the event.
    pub async fn broadcast(&self, event: HostEvent, language: Option<&str>) {
        let mut plugins = self.plugins.write().await;

        for (id, instance) in plugins.iter_mut() {
            // Skip inactive plugins
            if instance.state != PluginState::Active {
                continue;
            }

            // Skip plugins that don't support this language (if specified)
            if let Some(lang) = language {
                if !instance.plugin.supports_language(lang) {
                    continue;
                }
            }

            // Send event to plugin
            if let Err(e) = instance.plugin.on_event(event.clone()).await {
                warn!("Plugin {} failed to handle event: {}", id, e);
            }
        }
    }

    /// Get information about all registered plugins
    pub async fn list_plugins(&self) -> Vec<(PluginManifest, PluginState, Option<String>)> {
        self.plugins
            .read()
            .await
            .values()
            .map(|i| (i.manifest.clone(), i.state, i.error.clone()))
            .collect()
    }

    /// Check if a plugin is active
    pub async fn is_active(&self, plugin_id: &str) -> bool {
        self.plugins
            .read()
            .await
            .get(plugin_id)
            .map(|i| i.state == PluginState::Active)
            .unwrap_or(false)
    }

    /// Start the event forwarding loop
    ///
    /// This should be called once during app startup. It spawns a background
    /// task that forwards plugin events to the frontend via Tauri events.
    pub async fn start_event_loop(self: &Arc<Self>) {
        let mut rx = self
            .event_receiver
            .write()
            .await
            .take()
            .expect("Event loop already started");

        let host = Arc::clone(self);

        tokio::spawn(async move {
            info!("Plugin event loop started");

            while let Some(event) = rx.recv().await {
                let app = host.app_handle.read().await;
                if let Some(ref app) = *app {
                    if let Err(e) = app.emit("plugin-event", &event) {
                        error!("Failed to emit plugin event: {}", e);
                    }
                }
            }

            info!("Plugin event loop stopped");
        });
    }

    /// Emit a state change event
    fn emit_state_change(&self, plugin_id: &str, state: PluginState, error: Option<String>) {
        let _ = self.event_sender.send(PluginEvent::PluginStateChanged {
            plugin_id: plugin_id.to_string(),
            state,
            error,
        });
    }

    // =========================================================================
    // LSP Bridge Methods
    // =========================================================================

    /// Find an LSP provider for a given language
    fn find_lsp_provider_for_language<'a>(
        plugins: &'a HashMap<String, PluginInstance>,
        language: &str,
    ) -> Option<&'a dyn crate::plugins::types::LspProvider> {
        for instance in plugins.values() {
            if instance.state == PluginState::Active && instance.plugin.supports_language(language) {
                if let Some(provider) = instance.plugin.as_lsp_provider() {
                    return Some(provider);
                }
            }
        }
        None
    }

    /// Go to definition
    pub async fn lsp_goto_definition(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.goto_definition(path, line, character).await
    }

    /// Get hover information
    pub async fn lsp_hover(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspHover>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.hover(path, line, character).await
    }

    /// Get completions
    pub async fn lsp_completion(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<LspCompletionList, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.completion(path, line, character, trigger_character).await
    }

    /// Find references
    pub async fn lsp_references(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
        include_declaration: bool,
    ) -> Result<Vec<LspLocation>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.references(path, line, character, include_declaration).await
    }

    /// Rename symbol
    pub async fn lsp_rename(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
        new_name: &str,
    ) -> Result<LspWorkspaceEdit, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.rename(path, line, character, new_name).await
    }

    /// Get code actions
    pub async fn lsp_code_action(
        &self,
        language: &str,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        diagnostics: Vec<serde_json::Value>,
    ) -> Result<Vec<LspCodeAction>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider
            .code_action(path, start_line, start_character, end_line, end_character, diagnostics)
            .await
    }

    /// Get document symbols
    pub async fn lsp_document_symbols(
        &self,
        language: &str,
        path: &PathBuf,
    ) -> Result<Vec<LspDocumentSymbol>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.document_symbols(path).await
    }

    /// Get inlay hints
    pub async fn lsp_inlay_hints(
        &self,
        language: &str,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
    ) -> Result<Vec<LspInlayHint>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider
            .inlay_hints(path, start_line, start_character, end_line, end_character)
            .await
    }

    /// Get document highlights
    pub async fn lsp_document_highlight(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspDocumentHighlight>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.document_highlight(path, line, character).await
    }

    /// Get signature help
    pub async fn lsp_signature_help(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<Option<LspSignatureHelp>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider
            .signature_help(path, line, character, trigger_character)
            .await
    }

    /// Format document
    pub async fn lsp_format_document(
        &self,
        language: &str,
        path: &PathBuf,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.format_document(path, options).await
    }

    /// Format range
    pub async fn lsp_format_range(
        &self,
        language: &str,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider
            .format_range(
                path,
                start_line,
                start_character,
                end_line,
                end_character,
                options,
            )
            .await
    }

    /// Format on type
    pub async fn lsp_format_on_type(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: &str,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider
            .format_on_type(path, line, character, trigger_character, options)
            .await
    }

    /// Go to type definition
    pub async fn lsp_type_definition(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.type_definition(path, line, character).await
    }

    /// Go to implementation
    pub async fn lsp_implementation(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.implementation(path, line, character).await
    }

    /// Get folding ranges
    pub async fn lsp_folding_range(
        &self,
        language: &str,
        path: &PathBuf,
    ) -> Result<Vec<LspFoldingRange>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.folding_range(path).await
    }

    /// Get selection ranges
    pub async fn lsp_selection_range(
        &self,
        language: &str,
        path: &PathBuf,
        positions: Vec<LspPosition>,
    ) -> Result<Vec<LspSelectionRange>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.selection_range(path, positions).await
    }

    /// Get linked editing ranges
    pub async fn lsp_linked_editing_range(
        &self,
        language: &str,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspLinkedEditingRanges>, String> {
        let plugins = self.plugins.read().await;
        let provider = Self::find_lsp_provider_for_language(&plugins, language)
            .ok_or_else(|| format!("No LSP provider for language: {}", language))?;
        provider.linked_editing_range(path, line, character).await
    }
}

impl Default for PluginHost {
    fn default() -> Self {
        Self::new()
    }
}
