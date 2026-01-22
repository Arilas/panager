//! TypeScript Plugin
//!
//! Provides TypeScript and JavaScript language support via the
//! typescript-language-server LSP.

mod lsp;

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use async_trait::async_trait;
use tokio::process::Command;
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

use lsp::{TypeScriptConfig, TypeScriptLspClient};

/// TypeScript version info
#[derive(Debug, Clone)]
struct TypeScriptVersion {
    version: String,
    source: String,
}

/// TypeScript plugin state
pub struct TypeScriptPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<TypeScriptLspClient>>>,
    project_root: Option<PathBuf>,
    ts_version: Option<TypeScriptVersion>,
    config: TypeScriptConfig,
}

impl TypeScriptPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.typescript".to_string(),
                name: "TypeScript".to_string(),
                version: "1.0.0".to_string(),
                description: "TypeScript and JavaScript language support".to_string(),
                languages: vec![
                    "typescript".to_string(),
                    "typescriptreact".to_string(),
                    "javascript".to_string(),
                    "javascriptreact".to_string(),
                ],
                is_builtin: true,
            },
            ctx: None,
            lsp: Arc::new(RwLock::new(None)),
            project_root: None,
            ts_version: None,
            config: TypeScriptConfig::new(),
        }
    }

    async fn detect_typescript_version(root: &PathBuf) -> Option<TypeScriptVersion> {
        let local_pkg_path = root.join("node_modules/typescript/package.json");
        if local_pkg_path.exists() {
            if let Ok(content) = tokio::fs::read_to_string(&local_pkg_path).await {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(version) = pkg.get("version").and_then(|v| v.as_str()) {
                        debug!("Found local TypeScript: {}", version);
                        return Some(TypeScriptVersion {
                            version: version.to_string(),
                            source: "local".to_string(),
                        });
                    }
                }
            }
        }

        let output = Command::new("npx")
            .args(["tsc", "--version"])
            .current_dir(root)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let version = stdout
                    .trim()
                    .strip_prefix("Version ")
                    .unwrap_or(stdout.trim())
                    .to_string();
                if !version.is_empty() {
                    debug!("Found global TypeScript: {}", version);
                    return Some(TypeScriptVersion {
                        version,
                        source: "global".to_string(),
                    });
                }
            }
        }

        None
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping TypeScript LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;
        self.ts_version = None;

        if let Some(ref ctx) = self.ctx {
            ctx.update_status_bar(StatusBarItem {
                id: "ts-status".to_string(),
                text: "TS".to_string(),
                tooltip: Some("TypeScript Language Server (inactive)".to_string()),
                alignment: StatusBarAlignment::Right,
                priority: 50,
            });
        }
    }
}

impl Default for TypeScriptPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for TypeScriptPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating TypeScript plugin");
        self.ctx = Some(ctx.clone());

        ctx.update_status_bar(StatusBarItem {
            id: "ts-status".to_string(),
            text: "TS".to_string(),
            tooltip: Some("TypeScript Language Server".to_string()),
            alignment: StatusBarAlignment::Right,
            priority: 50,
        });

        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating TypeScript plugin");

        self.stop_lsp().await;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("ts-status".to_string());
        }

        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path, lsp_settings } => {
                let has_tsconfig = path.join("tsconfig.json").exists();
                let has_jsconfig = path.join("jsconfig.json").exists();
                let has_package_json = path.join("package.json").exists();
                let project_detected = has_tsconfig || has_jsconfig || has_package_json;

                // Check if user explicitly enabled/disabled the server
                let server_settings = lsp_settings.get("typescript");
                let should_start = match server_settings.and_then(|s| s.enabled) {
                    Some(true) => true,                // Explicitly enabled
                    Some(false) => false,              // Explicitly disabled
                    None => project_detected,          // Auto-detect based on project
                };

                if !should_start {
                    if server_settings.and_then(|s| s.enabled) == Some(false) {
                        debug!("TypeScript LSP disabled in settings");
                    } else {
                        debug!("Project doesn't appear to be a TypeScript/JavaScript project");
                    }
                    return Ok(());
                }

                // Check if user wants to use tsgo (Go-based TypeScript server)
                let use_tsgo = server_settings
                    .map(|s| s.settings.get("useTsgo").and_then(|v| v.as_bool()).unwrap_or(false))
                    .unwrap_or(false);

                // Create config with merged settings
                let config = if let Some(user_settings) = server_settings {
                    // Merge default settings with user settings
                    let defaults = TypeScriptConfig::new().default_settings();
                    let mut merged = defaults;
                    crate::ide::settings::deep_merge(&mut merged, &user_settings.settings);
                    TypeScriptConfig::with_settings(merged, use_tsgo)
                } else {
                    TypeScriptConfig::new()
                };

                // Spawn in background to not block other plugins
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                self.project_root = Some(path.clone());
                self.config = config;
                let config = TypeScriptConfig::with_settings(self.config.settings.clone(), use_tsgo);

                tokio::spawn(async move {
                    if use_tsgo {
                        info!("Starting tsgo (Go-based TypeScript LSP) for: {:?}", path);
                    } else {
                        info!("Starting TypeScript LSP for: {:?}", path);
                    }

                    // Detect TypeScript version (only relevant for non-tsgo)
                    let ts_version = if use_tsgo {
                        None
                    } else {
                        Self::detect_typescript_version(&path).await
                    };

                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                let (text, tooltip) = if use_tsgo {
                                    ("tsgo".to_string(), "TypeScript (tsgo - Go-based server)".to_string())
                                } else if let Some(ref ts_ver) = ts_version {
                                    (
                                        format!("TS {}", ts_ver.version),
                                        format!(
                                            "TypeScript {} ({})",
                                            ts_ver.version,
                                            if ts_ver.source == "local" { "project" } else { "global" }
                                        ),
                                    )
                                } else {
                                    ("TS".to_string(), "TypeScript Language Server running".to_string())
                                };

                                ctx.update_status_bar(StatusBarItem {
                                    id: "ts-status".to_string(),
                                    text,
                                    tooltip: Some(tooltip),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 50,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start TypeScript LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("TypeScript plugin received FileOpened: {:?}, lang: {}", path, language);
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    debug!("Sending didOpen to LSP for: {:?}", path);
                    lsp.did_open(&self.config, &path, &content).await;
                } else {
                    warn!("LSP not running, cannot send didOpen for: {:?}", path);
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
impl LspProvider for TypeScriptPlugin {
    async fn goto_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.goto_definition(path, line, character).await
    }

    async fn hover(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspHover>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.hover(path, line, character).await
    }

    async fn completion(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<LspCompletionList, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.completion(path, line, character, trigger_character).await
    }

    async fn references(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        include_declaration: bool,
    ) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.references(path, line, character, include_declaration).await
    }

    async fn rename(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        new_name: &str,
    ) -> Result<LspWorkspaceEdit, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.rename(path, line, character, new_name).await
    }

    async fn code_action(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        diagnostics: Vec<serde_json::Value>,
    ) -> Result<Vec<LspCodeAction>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.code_action(path, start_line, start_character, end_line, end_character, diagnostics).await
    }

    async fn document_symbols(&self, path: &PathBuf) -> Result<Vec<LspDocumentSymbol>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.document_symbols(path).await
    }

    async fn inlay_hints(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
    ) -> Result<Vec<LspInlayHint>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.inlay_hints(path, start_line, start_character, end_line, end_character).await
    }

    async fn document_highlight(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspDocumentHighlight>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.document_highlight(path, line, character).await
    }

    async fn signature_help(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<Option<LspSignatureHelp>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.signature_help(path, line, character, trigger_character).await
    }

    async fn format_document(
        &self,
        path: &PathBuf,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_document(path, options).await
    }

    async fn format_range(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_range(path, start_line, start_character, end_line, end_character, options).await
    }

    async fn format_on_type(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: &str,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.format_on_type(path, line, character, trigger_character, options).await
    }

    async fn type_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.type_definition(path, line, character).await
    }

    async fn implementation(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.implementation(path, line, character).await
    }

    async fn folding_range(&self, path: &PathBuf) -> Result<Vec<LspFoldingRange>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.folding_range(path).await
    }

    async fn selection_range(
        &self,
        path: &PathBuf,
        positions: Vec<LspPosition>,
    ) -> Result<Vec<LspSelectionRange>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.selection_range(path, positions).await
    }

    async fn linked_editing_range(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspLinkedEditingRanges>, String> {
        let lsp = self.lsp.read().await;
        let lsp = lsp.as_ref().ok_or("LSP not running")?;
        lsp.linked_editing_range(path, line, character).await
    }
}
