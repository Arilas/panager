//! ESLint Plugin
//!
//! Provides ESLint language support via vscode-eslint-language-server.
//! Auto-activates when an ESLint configuration file is detected.

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

/// ESLint language server configuration
pub struct EslintConfig;

impl EslintConfig {
    /// Check if a project has ESLint configured
    pub fn has_eslint_config(root: &PathBuf) -> bool {
        // ESLint flat config (eslint.config.*)
        let flat_configs = [
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
            "eslint.config.ts",
            "eslint.config.mts",
            "eslint.config.cts",
        ];

        for config in flat_configs {
            if root.join(config).exists() {
                return true;
            }
        }

        // Legacy ESLint configs (.eslintrc.*)
        let legacy_configs = [
            ".eslintrc",
            ".eslintrc.js",
            ".eslintrc.cjs",
            ".eslintrc.mjs",
            ".eslintrc.json",
            ".eslintrc.yaml",
            ".eslintrc.yml",
        ];

        for config in legacy_configs {
            if root.join(config).exists() {
                return true;
            }
        }

        // Check package.json for eslintConfig field
        let package_json = root.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    if pkg.get("eslintConfig").is_some() {
                        return true;
                    }
                }
            }
        }

        false
    }
}

impl LspConfig for EslintConfig {
    fn server_id(&self) -> &str {
        "eslint"
    }

    fn command(&self) -> &str {
        "npx"
    }

    fn args(&self) -> Vec<String> {
        vec![
            "--yes".to_string(),
            "--package=vscode-langservers-extracted".to_string(),
            "vscode-eslint-language-server".to_string(),
            "--stdio".to_string(),
        ]
    }

    fn initialization_options(&self, root: &PathBuf) -> serde_json::Value {
        // Detect if using flat config
        let flat_configs = [
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
            "eslint.config.ts",
            "eslint.config.mts",
            "eslint.config.cts",
        ];

        let uses_flat_config = flat_configs.iter().any(|c| root.join(c).exists());

        serde_json::json!({
            "nodePath": null,
            "workingDirectory": { "mode": "auto" },
            "experimental": {
                "useFlatConfig": uses_flat_config
            }
        })
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true,
                    "codeDescriptionSupport": true
                },
                "synchronization": {
                    "didSave": true,
                    "willSave": false,
                    "willSaveWaitUntil": false
                },
                "codeAction": {
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": [
                                "quickfix",
                                "source",
                                "source.fixAll",
                                "source.fixAll.eslint",
                                "source.organizeImports"
                            ]
                        }
                    },
                    "resolveSupport": {
                        "properties": ["edit"]
                    }
                }
            },
            "workspace": {
                "workspaceFolders": true,
                "configuration": true,
                "didChangeConfiguration": {
                    "dynamicRegistration": true
                }
            }
        })
    }

    fn workspace_configuration(&self) -> serde_json::Value {
        serde_json::json!({
            "eslint": {
                "enable": true,
                "run": "onType",
                "probe": [
                    "javascript",
                    "javascriptreact",
                    "typescript",
                    "typescriptreact",
                    "html",
                    "vue",
                    "markdown",
                    "json",
                    "jsonc"
                ],
                "validate": [
                    "javascript",
                    "javascriptreact",
                    "typescript",
                    "typescriptreact"
                ],
                "format": false,
                "codeActionsOnSave": {
                    "source.fixAll.eslint": true
                },
                "problems": {
                    "shortenToSingleLine": false
                },
                "useESLintClass": false,
                "experimental": {
                    "useFlatConfig": null
                },
                "workingDirectory": { "mode": "auto" }
            }
        })
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "tsx" => "typescriptreact",
            "jsx" => "javascriptreact",
            "js" | "mjs" | "cjs" => "javascript",
            "ts" | "mts" | "cts" => "typescript",
            "vue" => "vue",
            "html" | "htm" => "html",
            "md" | "mdx" => "markdown",
            "json" => "json",
            "jsonc" => "jsonc",
            _ => "javascript",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "ESLint"
    }

    fn should_activate(&self, root: &PathBuf) -> bool {
        Self::has_eslint_config(root)
    }
}

/// Type alias for ESLint LSP client
pub type EslintLspClient = LspClient<EslintConfig>;

/// ESLint plugin state
pub struct EslintPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<EslintLspClient>>>,
    project_root: Option<PathBuf>,
    config: EslintConfig,
}

impl EslintPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.eslint".to_string(),
                name: "ESLint".to_string(),
                version: "1.0.0".to_string(),
                description: "ESLint diagnostics and code actions".to_string(),
                languages: vec![
                    "javascript".to_string(),
                    "javascriptreact".to_string(),
                    "typescript".to_string(),
                    "typescriptreact".to_string(),
                ],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            config: EslintConfig,
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping ESLint LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("eslint-status".to_string());
        }
    }
}

impl Default for EslintPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for EslintPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating ESLint plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating ESLint plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path, .. } => {
                // Only start if ESLint config is detected
                if !EslintConfig::has_eslint_config(&path) {
                    debug!("No ESLint config detected in project, skipping LSP start");
                    return Ok(());
                }

                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = EslintConfig;
                tokio::spawn(async move {
                    info!("Starting ESLint LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "eslint-status".to_string(),
                                    text: "ESLint".to_string(),
                                    tooltip: Some("ESLint active".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 46,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start ESLint LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("ESLint plugin received FileOpened: {:?}, lang: {}", path, language);
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
        // Return true if the language is in our supported list
        // The actual LSP request will fail gracefully if LSP isn't ready
        // This avoids race conditions with try_read() during initialization
        self.manifest.languages.iter().any(|l| l == language)
        // Only provide support if LSP is running (meaning eslint config was detected)
    }

    fn as_lsp_provider(&self) -> Option<&dyn LspProvider> {
        Some(self)
    }
}

#[async_trait]
impl LspProvider for EslintPlugin {
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
