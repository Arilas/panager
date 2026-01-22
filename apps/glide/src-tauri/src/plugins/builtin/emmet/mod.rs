//! Emmet Plugin
//!
//! Provides Emmet abbreviation expansion for HTML, CSS, and JSX via emmet-language-server.
//! Enabled by default for HTML and JSX files.

use std::path::PathBuf;
use std::sync::Arc;
use async_trait::async_trait;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::plugins::context::PluginContext;
use crate::plugins::lsp::{LspClient, LspConfig};
use crate::plugins::types::{
    HostEvent, LspCodeAction, LspCompletionList, LspDocumentHighlight, LspDocumentSymbol,
    LspFoldingRange, LspFormattingOptions, LspHover, LspInlayHint, LspLinkedEditingRanges,
    LspLocation, LspPosition, LspProvider, LspSelectionRange, LspSignatureHelp, LspTextEdit,
    LspWorkspaceEdit, Plugin, PluginManifest, StatusBarAlignment, StatusBarItem,
};

/// Emmet language server configuration
pub struct EmmetConfig;

impl LspConfig for EmmetConfig {
    fn command(&self) -> &str {
        "npx"
    }

    fn args(&self) -> Vec<String> {
        vec![
            "--yes".to_string(),
            "emmet-language-server".to_string(),
            "--stdio".to_string(),
        ]
    }

    fn initialization_options(&self, _root: &PathBuf) -> serde_json::Value {
        serde_json::json!({
            "showExpandedAbbreviation": "always",
            "showAbbreviationSuggestions": true,
            "showSuggestionsAsSnippets": true,
            "syntaxProfiles": {},
            "variables": {},
            "preferences": {},
            "excludeLanguages": [],
            "includeLanguages": {
                "javascript": "javascriptreact",
                "typescript": "typescriptreact",
                "vue-html": "html",
                "svelte": "html"
            }
        })
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "synchronization": {
                    "didSave": true
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true,
                        "documentationFormat": ["markdown", "plaintext"],
                        "resolveSupport": {
                            "properties": ["documentation", "detail"]
                        }
                    },
                    "contextSupport": true
                }
            },
            "workspace": {
                "workspaceFolders": true,
                "configuration": true
            }
        })
    }

    fn workspace_configuration(&self) -> serde_json::Value {
        serde_json::json!({
            "emmet": {
                "showExpandedAbbreviation": "always",
                "showAbbreviationSuggestions": true,
                "showSuggestionsAsSnippets": true,
                "includeLanguages": {
                    "javascript": "javascriptreact",
                    "typescript": "typescriptreact"
                },
                "excludeLanguages": [],
                "syntaxProfiles": {
                    "html": {
                        "self_closing_tag": true
                    },
                    "jsx": {
                        "self_closing_tag": true,
                        "attr_quotes": "double"
                    }
                },
                "variables": {
                    "lang": "en"
                },
                "preferences": {
                    "bem.enabled": true
                }
            }
        })
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "html" | "htm" => "html",
            "css" => "css",
            "scss" => "scss",
            "sass" => "sass",
            "less" => "less",
            "jsx" => "javascriptreact",
            "tsx" => "typescriptreact",
            "vue" => "vue",
            "svelte" => "svelte",
            "astro" => "astro",
            _ => "html",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "Emmet"
    }
}

/// Type alias for Emmet LSP client
pub type EmmetLspClient = LspClient<EmmetConfig>;

/// Emmet plugin state
pub struct EmmetPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<EmmetLspClient>>>,
    project_root: Option<PathBuf>,
    config: EmmetConfig,
}

impl EmmetPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.emmet".to_string(),
                name: "Emmet".to_string(),
                version: "1.0.0".to_string(),
                description: "Emmet abbreviation expansion".to_string(),
                languages: vec![
                    "html".to_string(),
                    "css".to_string(),
                    "scss".to_string(),
                    "less".to_string(),
                    "javascript".to_string(),
                    "javascriptreact".to_string(),
                    "typescript".to_string(),
                    "typescriptreact".to_string(),
                    "vue".to_string(),
                    "svelte".to_string(),
                    "astro".to_string(),
                ],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            config: EmmetConfig,
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping Emmet LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("emmet-status".to_string());
        }
    }
}

impl Default for EmmetPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for EmmetPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating Emmet plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating Emmet plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path } => {
                // Emmet is always enabled for web projects
                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = EmmetConfig;
                tokio::spawn(async move {
                    info!("Starting Emmet LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "emmet-status".to_string(),
                                    text: "Emmet".to_string(),
                                    tooltip: Some("Emmet abbreviations active".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 43,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start Emmet LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("Emmet plugin received FileOpened: {:?}, lang: {}", path, language);
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_open(&self.config, &path, &content).await;
                }
            }

            HostEvent::FileClosed { path } => {
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_close(&path).await;
                }
            }

            HostEvent::FileChanged { path, content } => {
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_change(&path, &content).await;
                }
            }

            HostEvent::FileSaved { path } => {
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_save(&path).await;
                }
            }
        }

        Ok(())
    }

    fn as_lsp_provider(&self) -> Option<&dyn LspProvider> {
        Some(self)
    }
}

#[async_trait]
impl LspProvider for EmmetPlugin {
    async fn goto_definition(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Vec<LspLocation>, String> {
        // Emmet doesn't provide go to definition
        Ok(vec![])
    }

    async fn hover(&self, path: &PathBuf, line: u32, character: u32) -> Result<Option<LspHover>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.hover(path, line, character).await
    }

    async fn completion(&self, path: &PathBuf, line: u32, character: u32, trigger_character: Option<&str>) -> Result<LspCompletionList, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.completion(path, line, character, trigger_character).await
    }

    async fn references(&self, _path: &PathBuf, _line: u32, _character: u32, _include_declaration: bool) -> Result<Vec<LspLocation>, String> {
        Ok(vec![])
    }

    async fn rename(&self, _path: &PathBuf, _line: u32, _character: u32, _new_name: &str) -> Result<LspWorkspaceEdit, String> {
        Err("Emmet does not support rename".to_string())
    }

    async fn code_action(&self, _path: &PathBuf, _start_line: u32, _start_character: u32, _end_line: u32, _end_character: u32, _diagnostics: Vec<serde_json::Value>) -> Result<Vec<LspCodeAction>, String> {
        Ok(vec![])
    }

    async fn document_symbols(&self, _path: &PathBuf) -> Result<Vec<LspDocumentSymbol>, String> {
        Ok(vec![])
    }

    async fn inlay_hints(&self, _path: &PathBuf, _start_line: u32, _start_character: u32, _end_line: u32, _end_character: u32) -> Result<Vec<LspInlayHint>, String> {
        Ok(vec![])
    }

    async fn document_highlight(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Vec<LspDocumentHighlight>, String> {
        Ok(vec![])
    }

    async fn signature_help(&self, _path: &PathBuf, _line: u32, _character: u32, _trigger_character: Option<&str>) -> Result<Option<LspSignatureHelp>, String> {
        Ok(None)
    }

    async fn format_document(&self, _path: &PathBuf, _options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        Ok(vec![])
    }

    async fn format_range(&self, _path: &PathBuf, _start_line: u32, _start_character: u32, _end_line: u32, _end_character: u32, _options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        Ok(vec![])
    }

    async fn format_on_type(&self, _path: &PathBuf, _line: u32, _character: u32, _trigger_character: &str, _options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        Ok(vec![])
    }

    async fn type_definition(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Vec<LspLocation>, String> {
        Ok(vec![])
    }

    async fn implementation(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Vec<LspLocation>, String> {
        Ok(vec![])
    }

    async fn folding_range(&self, _path: &PathBuf) -> Result<Vec<LspFoldingRange>, String> {
        Ok(vec![])
    }

    async fn selection_range(&self, _path: &PathBuf, _positions: Vec<LspPosition>) -> Result<Vec<LspSelectionRange>, String> {
        Ok(vec![])
    }

    async fn linked_editing_range(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Option<LspLinkedEditingRanges>, String> {
        Ok(None)
    }
}
