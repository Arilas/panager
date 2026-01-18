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
use crate::plugins::types::{
    HostEvent, LspCodeAction, LspCompletionList, LspHover, LspLocation, LspProvider,
    LspWorkspaceEdit, Plugin, PluginManifest, StatusBarAlignment, StatusBarItem,
};

use lsp::LspClient;

/// TypeScript version info
#[derive(Debug, Clone)]
struct TypeScriptVersion {
    /// The version string (e.g., "5.3.3")
    version: String,
    /// Where TypeScript was found ("local" or "global")
    source: String,
}

/// TypeScript plugin state
pub struct TypeScriptPlugin {
    /// Plugin metadata
    manifest: PluginManifest,
    /// Plugin context for communication
    ctx: Option<PluginContext>,
    /// LSP client
    lsp: Arc<RwLock<Option<LspClient>>>,
    /// Project root path
    project_root: Option<PathBuf>,
    /// Detected TypeScript version
    ts_version: Option<TypeScriptVersion>,
}

impl TypeScriptPlugin {
    /// Create a new TypeScript plugin instance
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
        }
    }

    /// Detect TypeScript version in a project
    /// Returns (version, source) where source is "local" or "global"
    async fn detect_typescript_version(root: &PathBuf) -> Option<TypeScriptVersion> {
        // First, try to read local TypeScript version from node_modules
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

        // Fall back to global TypeScript via npx
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
                // Output is like "Version 5.3.3"
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

    /// Start the LSP server for a project
    async fn start_lsp(&mut self, root: &PathBuf) -> Result<(), String> {
        info!("Starting TypeScript LSP for: {:?}", root);

        let ctx = self.ctx.clone().ok_or("Plugin not activated")?;

        // Detect TypeScript version
        self.ts_version = Self::detect_typescript_version(root).await;

        let lsp = LspClient::start(root, ctx).await?;

        *self.lsp.write().await = Some(lsp);
        self.project_root = Some(root.clone());

        // Update status bar to show TypeScript version
        if let Some(ref ctx) = self.ctx {
            let (text, tooltip) = if let Some(ref ts_ver) = self.ts_version {
                (
                    format!("TS {}", ts_ver.version),
                    format!(
                        "TypeScript {} ({})",
                        ts_ver.version,
                        if ts_ver.source == "local" {
                            "project"
                        } else {
                            "global"
                        }
                    ),
                )
            } else {
                (
                    "TS".to_string(),
                    "TypeScript Language Server running".to_string(),
                )
            };

            ctx.update_status_bar(StatusBarItem {
                id: "ts-status".to_string(),
                text,
                tooltip: Some(tooltip),
                alignment: StatusBarAlignment::Right,
                priority: 50,
            });
        }

        Ok(())
    }

    /// Stop the LSP server
    async fn stop_lsp(&mut self) {
        info!("Stopping TypeScript LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        self.project_root = None;
        self.ts_version = None;

        // Update status bar
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

        // Show initial status bar item
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

        // Stop LSP if running
        self.stop_lsp().await;

        // Remove status bar item
        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("ts-status".to_string());
        }

        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path } => {
                // Check if this looks like a TypeScript/JavaScript project
                let has_tsconfig = path.join("tsconfig.json").exists();
                let has_jsconfig = path.join("jsconfig.json").exists();
                let has_package_json = path.join("package.json").exists();

                if has_tsconfig || has_jsconfig || has_package_json {
                    if let Err(e) = self.start_lsp(&path).await {
                        warn!("Failed to start TypeScript LSP: {}", e);
                    }
                } else {
                    debug!("Project doesn't appear to be a TypeScript/JavaScript project");
                }
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened {
                path,
                content,
                language,
            } => {
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_open(&path, &content, &language).await;
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
        lsp.code_action(path, start_line, start_character, end_line, end_character, diagnostics)
            .await
    }
}
