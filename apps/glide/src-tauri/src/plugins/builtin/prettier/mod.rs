//! Prettier Plugin
//!
//! Provides code formatting via Prettier.
//! Auto-activates when a Prettier configuration is detected.

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use async_trait::async_trait;
use tokio::process::Command;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::plugins::context::PluginContext;
use crate::plugins::types::{
    HostEvent, LspCodeAction, LspCompletionList, LspDocumentHighlight, LspDocumentSymbol,
    LspFoldingRange, LspFormattingOptions, LspHover, LspInlayHint, LspLinkedEditingRanges,
    LspLocation, LspPosition, LspProvider, LspSelectionRange, LspSignatureHelp, LspTextEdit,
    LspRange, LspWorkspaceEdit, Plugin, PluginManifest, StatusBarAlignment, StatusBarItem,
};

/// Prettier configuration
pub struct PrettierConfig {
    project_root: PathBuf,
}

impl PrettierConfig {
    /// Check if a project has Prettier configured
    pub fn has_prettier_config(root: &PathBuf) -> bool {
        let config_files = [
            ".prettierrc",
            ".prettierrc.json",
            ".prettierrc.yml",
            ".prettierrc.yaml",
            ".prettierrc.json5",
            ".prettierrc.js",
            ".prettierrc.cjs",
            ".prettierrc.mjs",
            ".prettierrc.toml",
            "prettier.config.js",
            "prettier.config.cjs",
            "prettier.config.mjs",
        ];

        for config in config_files {
            if root.join(config).exists() {
                return true;
            }
        }

        // Check package.json for prettier field
        let package_json = root.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    if pkg.get("prettier").is_some() {
                        return true;
                    }
                }
            }
        }

        false
    }

    fn get_parser_for_file(&self, path: &PathBuf) -> Option<&'static str> {
        let ext = path.extension()?.to_str()?;
        match ext {
            "js" | "mjs" | "cjs" | "jsx" => Some("babel"),
            "ts" | "mts" | "cts" => Some("typescript"),
            "tsx" => Some("typescript"),
            "json" | "json5" => Some("json"),
            "css" => Some("css"),
            "scss" => Some("scss"),
            "less" => Some("less"),
            "html" | "htm" => Some("html"),
            "vue" => Some("vue"),
            "svelte" => Some("svelte"),
            "md" | "mdx" => Some("markdown"),
            "yaml" | "yml" => Some("yaml"),
            "graphql" | "gql" => Some("graphql"),
            _ => None,
        }
    }
}

/// Prettier plugin state
pub struct PrettierPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    project_root: Arc<RwLock<Option<PathBuf>>>,
    is_active: Arc<RwLock<bool>>,
}

impl PrettierPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.prettier".to_string(),
                name: "Prettier".to_string(),
                version: "1.0.0".to_string(),
                description: "Code formatting with Prettier".to_string(),
                languages: vec![
                    "javascript".to_string(),
                    "javascriptreact".to_string(),
                    "typescript".to_string(),
                    "typescriptreact".to_string(),
                    "json".to_string(),
                    "jsonc".to_string(),
                    "css".to_string(),
                    "scss".to_string(),
                    "less".to_string(),
                    "html".to_string(),
                    "vue".to_string(),
                    "svelte".to_string(),
                    "markdown".to_string(),
                    "yaml".to_string(),
                    "graphql".to_string(),
                ],
                is_builtin: true,
            },
            ctx: None,
            project_root: Arc::new(RwLock::new(None)),
            is_active: Arc::new(RwLock::new(false)),
        }
    }

    async fn format_with_prettier(&self, path: &PathBuf, content: &str) -> Result<String, String> {
        let root = self.project_root.read().await;
        let root = root.as_ref().ok_or("No project root set")?;

        let config = PrettierConfig {
            project_root: root.clone(),
        };

        let parser = config
            .get_parser_for_file(path)
            .ok_or_else(|| format!("No Prettier parser for file: {:?}", path))?;

        // Run prettier via npx
        let mut cmd = Command::new("npx");
        cmd.args([
            "--yes",
            "prettier",
            "--parser",
            parser,
            "--stdin-filepath",
            &path.to_string_lossy(),
        ])
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn prettier: {}", e))?;

        // Write content to stdin
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            stdin
                .write_all(content.as_bytes())
                .await
                .map_err(|e| format!("Failed to write to prettier stdin: {}", e))?;
        }

        let output = child
            .wait_with_output()
            .await
            .map_err(|e| format!("Failed to wait for prettier: {}", e))?;

        if output.status.success() {
            String::from_utf8(output.stdout)
                .map_err(|e| format!("Prettier output not valid UTF-8: {}", e))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Prettier failed: {}", stderr))
        }
    }
}

impl Default for PrettierPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for PrettierPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating Prettier plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating Prettier plugin");
        *self.is_active.write().await = false;
        *self.project_root.write().await = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("prettier-status".to_string());
        }

        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path, .. } => {
                // Only activate if prettier config is detected
                if !PrettierConfig::has_prettier_config(&path) {
                    debug!("No Prettier config detected in project");
                    return Ok(());
                }

                *self.project_root.write().await = Some(path.clone());
                *self.is_active.write().await = true;

                if let Some(ref ctx) = self.ctx {
                    ctx.update_status_bar(StatusBarItem {
                        id: "prettier-status".to_string(),
                        text: "Prettier".to_string(),
                        tooltip: Some("Prettier formatting active".to_string()),
                        alignment: StatusBarAlignment::Right,
                        priority: 44,
                    });
                }

                info!("Prettier plugin activated for: {:?}", path);
            }

            HostEvent::ProjectClosed => {
                *self.is_active.write().await = false;
                *self.project_root.write().await = None;

                if let Some(ref ctx) = self.ctx {
                    ctx.remove_status_bar("prettier-status".to_string());
                }
            }

            _ => {}
        }

        Ok(())
    }

    fn supports_language(&self, language: &str) -> bool {
        if *self.is_active.try_read().unwrap_or(&std::sync::RwLock::new(false).read().unwrap()) {
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
impl LspProvider for PrettierPlugin {
    // Prettier only provides formatting, so most methods return empty/errors

    async fn goto_definition(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Vec<LspLocation>, String> {
        Ok(vec![])
    }

    async fn hover(&self, _path: &PathBuf, _line: u32, _character: u32) -> Result<Option<LspHover>, String> {
        Ok(None)
    }

    async fn completion(&self, _path: &PathBuf, _line: u32, _character: u32, _trigger_character: Option<&str>) -> Result<LspCompletionList, String> {
        Ok(LspCompletionList {
            is_incomplete: false,
            items: vec![],
        })
    }

    async fn references(&self, _path: &PathBuf, _line: u32, _character: u32, _include_declaration: bool) -> Result<Vec<LspLocation>, String> {
        Ok(vec![])
    }

    async fn rename(&self, _path: &PathBuf, _line: u32, _character: u32, _new_name: &str) -> Result<LspWorkspaceEdit, String> {
        Err("Prettier does not support rename".to_string())
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

    async fn format_document(&self, path: &PathBuf, _options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        if !*self.is_active.read().await {
            return Err("Prettier not active".to_string());
        }

        // Read the file content
        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let formatted = self.format_with_prettier(path, &content).await?;

        // If content is the same, return empty edits
        if content == formatted {
            return Ok(vec![]);
        }

        // Calculate line count for the full document replacement
        let line_count = content.lines().count() as u32;
        let last_line_length = content.lines().last().map(|l| l.len()).unwrap_or(0) as u32;

        Ok(vec![LspTextEdit {
            range: LspRange {
                start: LspPosition { line: 0, character: 0 },
                end: LspPosition {
                    line: line_count,
                    character: last_line_length,
                },
            },
            new_text: formatted,
        }])
    }

    async fn format_range(&self, path: &PathBuf, _start_line: u32, _start_character: u32, _end_line: u32, _end_character: u32, options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        // Prettier doesn't support range formatting well, so we format the whole document
        self.format_document(path, options).await
    }

    async fn format_on_type(&self, _path: &PathBuf, _line: u32, _character: u32, _trigger_character: &str, _options: LspFormattingOptions) -> Result<Vec<LspTextEdit>, String> {
        // Prettier doesn't support on-type formatting
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
