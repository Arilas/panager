//! JSON Plugin
//!
//! Provides JSON and JSONC language support via vscode-json-language-server.

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

/// JSON language server configuration
pub struct JsonConfig;

impl LspConfig for JsonConfig {
    fn command(&self) -> &str {
        "npx"
    }

    fn args(&self) -> Vec<String> {
        vec![
            "--yes".to_string(),
            "--package=vscode-langservers-extracted".to_string(),
            "vscode-json-language-server".to_string(),
            "--stdio".to_string(),
        ]
    }

    fn initialization_options(&self, _root: &PathBuf) -> serde_json::Value {
        serde_json::json!({
            "provideFormatter": true,
            "handledSchemaProtocols": ["file", "http", "https"]
        })
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true
                },
                "synchronization": {
                    "didSave": true
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true,
                        "documentationFormat": ["markdown", "plaintext"]
                    }
                },
                "documentSymbol": {
                    "hierarchicalDocumentSymbolSupport": true
                },
                "formatting": {},
                "rangeFormatting": {},
                "foldingRange": {
                    "lineFoldingOnly": true
                },
                "colorProvider": {}
            },
            "workspace": {
                "workspaceFolders": true,
                "configuration": true
            }
        })
    }

    fn workspace_configuration(&self) -> serde_json::Value {
        serde_json::json!({
            "json": {
                "format": {
                    "enable": true
                },
                "validate": {
                    "enable": true
                },
                "schemas": []
            }
        })
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "jsonc" => "jsonc",
            _ => "json",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "JSON"
    }
}

/// Type alias for JSON LSP client
pub type JsonLspClient = LspClient<JsonConfig>;

/// JSON plugin state
pub struct JsonPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<JsonLspClient>>>,
    project_root: Option<PathBuf>,
    config: JsonConfig,
}

impl JsonPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.json".to_string(),
                name: "JSON".to_string(),
                version: "1.0.0".to_string(),
                description: "JSON and JSONC language support".to_string(),
                languages: vec!["json".to_string(), "jsonc".to_string()],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            config: JsonConfig,
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping JSON LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("json-status".to_string());
        }
    }
}

impl Default for JsonPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for JsonPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating JSON plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating JSON plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path } => {
                // JSON support is universal - start for any project
                // Spawn in background to not block other plugins
                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = JsonConfig;
                tokio::spawn(async move {
                    info!("Starting JSON LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "json-status".to_string(),
                                    text: "JSON".to_string(),
                                    tooltip: Some("JSON Language Server running".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 49,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start JSON LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("JSON plugin received FileOpened: {:?}, lang: {}", path, language);
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
impl LspProvider for JsonPlugin {
    async fn goto_definition(&self, path: &PathBuf, line: u32, character: u32) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.goto_definition(path, line, character).await
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

    async fn references(&self, path: &PathBuf, line: u32, character: u32, include_declaration: bool) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.references(path, line, character, include_declaration).await
    }

    async fn rename(&self, path: &PathBuf, line: u32, character: u32, new_name: &str) -> Result<LspWorkspaceEdit, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.rename(path, line, character, new_name).await
    }

    async fn code_action(&self, path: &PathBuf, start_line: u32, start_character: u32, end_line: u32, end_character: u32, diagnostics: Vec<serde_json::Value>) -> Result<Vec<LspCodeAction>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.code_action(path, start_line, start_character, end_line, end_character, diagnostics).await
    }

    async fn document_symbols(&self, path: &PathBuf) -> Result<Vec<LspDocumentSymbol>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.document_symbols(path).await
    }

    async fn inlay_hints(&self, path: &PathBuf, start_line: u32, start_character: u32, end_line: u32, end_character: u32) -> Result<Vec<LspInlayHint>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.inlay_hints(path, start_line, start_character, end_line, end_character).await
    }

    async fn document_highlight(&self, path: &PathBuf, line: u32, character: u32) -> Result<Vec<LspDocumentHighlight>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.document_highlight(path, line, character).await
    }

    async fn signature_help(&self, path: &PathBuf, line: u32, character: u32, trigger_character: Option<&str>) -> Result<Option<LspSignatureHelp>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.signature_help(path, line, character, trigger_character).await
    }

    async fn format_document(&self, path: &PathBuf, options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_document(path, options).await
    }

    async fn format_range(&self, path: &PathBuf, start_line: u32, start_character: u32, end_line: u32, end_character: u32, options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_range(path, start_line, start_character, end_line, end_character, options).await
    }

    async fn format_on_type(&self, path: &PathBuf, line: u32, character: u32, trigger_character: &str, options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_on_type(path, line, character, trigger_character, options).await
    }

    async fn type_definition(&self, path: &PathBuf, line: u32, character: u32) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.type_definition(path, line, character).await
    }

    async fn implementation(&self, path: &PathBuf, line: u32, character: u32) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.implementation(path, line, character).await
    }

    async fn folding_range(&self, path: &PathBuf) -> Result<Vec<LspFoldingRange>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.folding_range(path).await
    }

    async fn selection_range(&self, path: &PathBuf, positions: Vec<LspPosition>) -> Result<Vec<LspSelectionRange>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.selection_range(path, positions).await
    }

    async fn linked_editing_range(&self, path: &PathBuf, line: u32, character: u32) -> Result<Option<LspLinkedEditingRanges>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.linked_editing_range(path, line, character).await
    }
}
