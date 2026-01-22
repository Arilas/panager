//! Rust Analyzer Plugin
//!
//! Provides Rust language support via rust-analyzer.
//! Requires rust-analyzer to be installed and available in PATH.
//! Auto-activates when Cargo.toml is detected.

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

/// Rust Analyzer language server configuration
pub struct RustAnalyzerConfig;

impl RustAnalyzerConfig {
    /// Check if rust-analyzer is available in PATH
    pub fn is_available() -> bool {
        std::process::Command::new("rust-analyzer")
            .arg("--version")
            .output()
            .is_ok()
    }

    /// Check if a project is a Rust project
    pub fn is_rust_project(root: &PathBuf) -> bool {
        root.join("Cargo.toml").exists()
    }
}

impl LspConfig for RustAnalyzerConfig {
    fn command(&self) -> &str {
        "rust-analyzer"
    }

    fn args(&self) -> Vec<String> {
        vec![]
    }

    fn initialization_options(&self, _root: &PathBuf) -> serde_json::Value {
        serde_json::json!({
            "checkOnSave": {
                "command": "clippy"
            },
            "cargo": {
                "allFeatures": true,
                "loadOutDirsFromCheck": true
            },
            "procMacro": {
                "enable": true
            },
            "inlayHints": {
                "chainingHints": true,
                "parameterHints": true,
                "typeHints": true
            }
        })
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true,
                    "codeDescriptionSupport": true,
                    "dataSupport": true
                },
                "synchronization": {
                    "didSave": true,
                    "willSave": false,
                    "willSaveWaitUntil": false
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true,
                        "commitCharactersSupport": true,
                        "documentationFormat": ["markdown", "plaintext"],
                        "resolveSupport": {
                            "properties": ["documentation", "detail", "additionalTextEdits"]
                        }
                    },
                    "contextSupport": true
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "signatureHelp": {
                    "signatureInformation": {
                        "documentationFormat": ["markdown", "plaintext"],
                        "parameterInformation": {
                            "labelOffsetSupport": true
                        }
                    }
                },
                "definition": {
                    "linkSupport": true
                },
                "typeDefinition": {
                    "linkSupport": true
                },
                "implementation": {
                    "linkSupport": true
                },
                "references": {},
                "documentHighlight": {},
                "documentSymbol": {
                    "hierarchicalDocumentSymbolSupport": true
                },
                "codeAction": {
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": [
                                "quickfix",
                                "refactor",
                                "refactor.extract",
                                "refactor.inline",
                                "refactor.rewrite",
                                "source",
                                "source.organizeImports"
                            ]
                        }
                    },
                    "resolveSupport": {
                        "properties": ["edit"]
                    }
                },
                "formatting": {},
                "rangeFormatting": {},
                "rename": {
                    "prepareSupport": true
                },
                "foldingRange": {
                    "foldingRangeKind": {
                        "valueSet": ["comment", "imports", "region"]
                    }
                },
                "selectionRange": {},
                "inlayHint": {
                    "resolveSupport": {
                        "properties": ["tooltip", "textEdits", "label.command"]
                    }
                }
            },
            "workspace": {
                "workspaceFolders": true,
                "configuration": true,
                "didChangeConfiguration": {
                    "dynamicRegistration": true
                },
                "symbol": {
                    "symbolKind": {
                        "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                    }
                }
            }
        })
    }

    fn workspace_configuration(&self) -> serde_json::Value {
        serde_json::json!({
            "rust-analyzer": {
                "checkOnSave": {
                    "command": "clippy"
                },
                "cargo": {
                    "allFeatures": true
                },
                "procMacro": {
                    "enable": true
                }
            }
        })
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "rs" => "rust",
            _ => "rust",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "rust-analyzer"
    }

    fn should_activate(&self, root: &PathBuf) -> bool {
        Self::is_rust_project(root) && Self::is_available()
    }
}

/// Type alias for Rust Analyzer LSP client
pub type RustAnalyzerLspClient = LspClient<RustAnalyzerConfig>;

/// Rust Analyzer plugin state
pub struct RustAnalyzerPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<RustAnalyzerLspClient>>>,
    project_root: Option<PathBuf>,
    config: RustAnalyzerConfig,
}

impl RustAnalyzerPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.rust-analyzer".to_string(),
                name: "Rust Analyzer".to_string(),
                version: "1.0.0".to_string(),
                description: "Rust language support via rust-analyzer".to_string(),
                languages: vec!["rust".to_string()],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            config: RustAnalyzerConfig,
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping Rust Analyzer LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("rust-analyzer-status".to_string());
        }
    }
}

impl Default for RustAnalyzerPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for RustAnalyzerPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating Rust Analyzer plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating Rust Analyzer plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path } => {
                if !RustAnalyzerConfig::is_rust_project(&path) {
                    debug!("No Cargo.toml detected, skipping Rust Analyzer LSP start");
                    return Ok(());
                }

                if !RustAnalyzerConfig::is_available() {
                    warn!("rust-analyzer not found in PATH, skipping LSP start");
                    return Ok(());
                }

                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = RustAnalyzerConfig;
                tokio::spawn(async move {
                    info!("Starting Rust Analyzer LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "rust-analyzer-status".to_string(),
                                    text: "Rust".to_string(),
                                    tooltip: Some("Rust Analyzer active".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 45,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start Rust Analyzer LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("Rust Analyzer plugin received FileOpened: {:?}, lang: {}", path, language);
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

    fn supports_language(&self, language: &str) -> bool {
        if self.lsp.try_read().map(|l| l.is_some()).unwrap_or(false) {
            self.manifest.languages.iter().any(|l| l == language)
        } else {
            false
        }
    }

    fn as_lsp_provider(&self) -> Option<&dyn LspProvider> {
        Some(self)
    }
}

#[async_trait]
impl LspProvider for RustAnalyzerPlugin {
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
