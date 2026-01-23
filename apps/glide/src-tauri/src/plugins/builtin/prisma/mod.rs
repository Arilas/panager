//! Prisma Plugin
//!
//! Provides Prisma schema language support via @prisma/language-server.
//! Auto-activates when schema.prisma is detected.

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

/// Prisma language server configuration
pub struct PrismaConfig;

impl PrismaConfig {
    /// Check if a project has Prisma schema
    pub fn has_prisma(root: &PathBuf) -> bool {
        // Check for schema.prisma in common locations
        let prisma_files = [
            "schema.prisma",
            "prisma/schema.prisma",
        ];

        for file in prisma_files {
            if root.join(file).exists() {
                return true;
            }
        }

        // Check in monorepo directories (apps/*, packages/*, libs/*)
        let monorepo_dirs = ["apps", "packages", "libs"];
        for monorepo_dir in monorepo_dirs {
            let dir_path = root.join(monorepo_dir);
            if dir_path.exists() && dir_path.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&dir_path) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            for file in &prisma_files {
                                if entry.path().join(file).exists() {
                                    info!("Found Prisma schema in monorepo: {:?}", entry.path().join(file));
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check package.json for prisma dependency
        let package_json = root.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if content.contains("\"prisma\"") || content.contains("\"@prisma/client\"") {
                    return true;
                }
            }
        }

        false
    }
}

impl LspConfig for PrismaConfig {
    fn server_id(&self) -> &str {
        "prisma"
    }

    fn command(&self) -> &str {
        "npx"
    }

    fn args(&self) -> Vec<String> {
        vec![
            "--yes".to_string(),
            "@prisma/language-server".to_string(),
            "--stdio".to_string(),
        ]
    }

    fn initialization_options(&self, _root: &PathBuf) -> serde_json::Value {
        serde_json::json!({})
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true
                },
                "synchronization": {
                    "didSave": true,
                    "willSave": false,
                    "willSaveWaitUntil": false
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true,
                        "documentationFormat": ["markdown", "plaintext"]
                    }
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "formatting": {},
                "codeAction": {
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": [
                                "quickfix",
                                "source"
                            ]
                        }
                    }
                },
                "definition": {
                    "linkSupport": true
                },
                "references": {},
                "rename": {
                    "prepareSupport": true
                },
                "documentSymbol": {
                    "hierarchicalDocumentSymbolSupport": true
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
            "prisma": {
                "trace": {
                    "server": "off"
                }
            }
        })
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "prisma" => "prisma",
            _ => "prisma",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "prisma"
    }

    fn should_activate(&self, root: &PathBuf) -> bool {
        Self::has_prisma(root)
    }
}

/// Type alias for Prisma LSP client
pub type PrismaLspClient = LspClient<PrismaConfig>;

/// Struct to hold file info for pending files
struct OpenFile {
    path: PathBuf,
    content: String,
}

/// Prisma plugin state
pub struct PrismaPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<PrismaLspClient>>>,
    project_root: Option<PathBuf>,
    config: PrismaConfig,
    /// Files that were opened before LSP was ready - will be synced when LSP starts
    pending_files: Arc<RwLock<Vec<OpenFile>>>,
}

impl PrismaPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.prisma".to_string(),
                name: "Prisma".to_string(),
                version: "1.0.0".to_string(),
                description: "Prisma schema language support".to_string(),
                languages: vec!["prisma".to_string()],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            config: PrismaConfig,
            pending_files: Arc::new(RwLock::new(Vec::new())),
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping Prisma LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        // Clear pending files
        self.pending_files.write().await.clear();

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("prisma-status".to_string());
        }
    }
}

impl Default for PrismaPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for PrismaPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating Prisma plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating Prisma plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path, .. } => {
                if !PrismaConfig::has_prisma(&path) {
                    debug!("No Prisma schema detected, skipping Prisma LSP start");
                    return Ok(());
                }

                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = PrismaConfig;
                let pending_files = self.pending_files.clone();
                tokio::spawn(async move {
                    info!("Starting Prisma LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            // Sync any files that were opened before LSP was ready
                            let files_to_sync = pending_files.write().await.drain(..).collect::<Vec<_>>();
                            for file in files_to_sync {
                                debug!("Syncing pending file to Prisma LSP: {:?}", file.path);
                                client.did_open(&config, &file.path, &file.content).await;
                            }

                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "prisma-status".to_string(),
                                    text: "Prisma".to_string(),
                                    tooltip: Some("Prisma language server active".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 48,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start Prisma LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("Prisma plugin received FileOpened: {:?}, lang: {}", path, language);
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_open(&self.config, &path, &content).await;
                } else {
                    // LSP not ready yet, queue the file for later sync
                    debug!("Prisma LSP not ready, queuing file: {:?}", path);
                    self.pending_files.write().await.push(OpenFile {
                        path: path.clone(),
                        content: content.clone(),
                    });
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
        // Return true if the language is in our supported list
        // The actual LSP request will fail gracefully if LSP isn't ready
        // This avoids race conditions with try_read() during initialization
        self.manifest.languages.iter().any(|l| l == language)
    }

    fn as_lsp_provider(&self) -> Option<&dyn LspProvider> {
        Some(self)
    }
}

#[async_trait]
impl LspProvider for PrismaPlugin {
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
