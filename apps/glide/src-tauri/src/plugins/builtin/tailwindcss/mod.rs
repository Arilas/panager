//! Tailwind CSS Plugin
//!
//! Provides Tailwind CSS language support via @tailwindcss/language-server.
//! Auto-activates when tailwindcss is detected in package.json or lock files.

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

/// Tailwind CSS language server configuration
pub struct TailwindCssConfig;

impl TailwindCssConfig {
    /// Check if a project has Tailwind CSS installed by examining:
    /// - package.json dependencies
    /// - Lock files (package-lock.json, yarn.lock, pnpm-lock.yaml)
    /// - Tailwind config files (tailwind.config.js/ts/cjs/mjs)
    /// - CSS files with @import 'tailwindcss' (Tailwind v4)
    pub fn has_tailwind(root: &PathBuf) -> bool {
        // Check package.json for tailwindcss dependency
        let package_json = root.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if content.contains("tailwindcss") {
                    return true;
                }
            }
        }

        // Check common lock files
        let lock_files = [
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
        ];

        for lock_file in lock_files {
            let lock_path = root.join(lock_file);
            if lock_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&lock_path) {
                    if content.contains("tailwindcss") {
                        return true;
                    }
                }
            }
        }

        // Check for tailwind config files (v3 and earlier)
        let config_files = [
            "tailwind.config.js",
            "tailwind.config.ts",
            "tailwind.config.cjs",
            "tailwind.config.mjs",
        ];

        for config_file in config_files {
            if root.join(config_file).exists() {
                return true;
            }
        }

        // Check for Tailwind v4 CSS import pattern: @import 'tailwindcss' or @import "tailwindcss"
        // Look in common CSS entry points
        if Self::check_css_for_tailwind_import(root) {
            return true;
        }

        false
    }

    /// Check CSS files for Tailwind v4 import pattern
    fn check_css_for_tailwind_import(root: &PathBuf) -> bool {
        // Reuse find_tailwind_v4_css which has full monorepo support
        Self::find_tailwind_v4_css(root).is_some()
    }

    /// Find CSS file with Tailwind v4 import and return its path
    fn find_tailwind_v4_css(root: &PathBuf) -> Option<String> {
        info!("Looking for Tailwind v4 CSS in: {}", root.display());

        // Common CSS entry point locations (relative to project root or package root)
        let css_paths = [
            "src/index.css",
            "src/styles.css",
            "src/global.css",
            "src/globals.css",
            "src/app.css",
            "src/main.css",
            "styles/globals.css",
            "styles/global.css",
            "styles/index.css",
            "app/globals.css",
            "app/global.css",
            "assets/css/main.css",
            "css/main.css",
            "css/styles.css",
        ];

        // Check root level first
        for css_path in &css_paths {
            if let Some(path) = Self::check_css_file_for_tailwind(root, css_path) {
                info!("Found Tailwind v4 CSS at root level: {}", path);
                return Some(path);
            }
        }

        // For monorepos, also check in apps/* and packages/* subdirectories
        let monorepo_dirs = ["apps", "packages", "libs"];
        for monorepo_dir in monorepo_dirs {
            let dir_path = root.join(monorepo_dir);
            if dir_path.exists() && dir_path.is_dir() {
                info!("Checking monorepo directory: {}", dir_path.display());
                if let Ok(entries) = std::fs::read_dir(&dir_path) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            debug!("Checking package: {}", entry.path().display());
                            for css_path in &css_paths {
                                if let Some(path) = Self::check_css_file_for_tailwind(&entry.path(), css_path) {
                                    info!("Found Tailwind v4 CSS in monorepo package: {}", path);
                                    return Some(path);
                                }
                            }
                        }
                    }
                }
            }
        }

        info!("No Tailwind v4 CSS file found in project");
        None
    }

    /// Check a specific CSS file for Tailwind v4 import
    fn check_css_file_for_tailwind(base: &PathBuf, css_path: &str) -> Option<String> {
        let full_path = base.join(css_path);
        if full_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&full_path) {
                // Check for various Tailwind import patterns
                let has_tailwind = content.contains("@import 'tailwindcss'")
                    || content.contains("@import \"tailwindcss\"")
                    || content.contains("@import 'tailwindcss/")
                    || content.contains("@import \"tailwindcss/")
                    // Also check for @tailwind directives (v3 style, but still valid)
                    || content.contains("@tailwind base")
                    || content.contains("@tailwind components")
                    || content.contains("@tailwind utilities");

                if has_tailwind {
                    debug!("CSS file {} contains Tailwind directives", full_path.display());
                    return Some(full_path.to_string_lossy().to_string());
                } else {
                    debug!("CSS file {} exists but no Tailwind imports found", full_path.display());
                }
            }
        }
        None
    }
}

impl LspConfig for TailwindCssConfig {
    fn server_id(&self) -> &str {
        "tailwindcss"
    }

    fn command(&self) -> &str {
        "npx"
    }

    fn args(&self) -> Vec<String> {
        vec![
            "--yes".to_string(),
            // Use the official @tailwindcss/language-server package
            // Specify package and executable separately for scoped packages
            "--package=@tailwindcss/language-server".to_string(),
            "tailwindcss-language-server".to_string(),
            "--stdio".to_string(),
        ]
    }

    fn initialization_options(&self, root: &PathBuf) -> serde_json::Value {
        info!("Building Tailwind initialization options for: {}", root.display());

        // For v4, Tailwind LSP may have trouble detecting CSS files in monorepos
        // We can explicitly specify the config file path to help it find the project
        // See: https://github.com/tailwindlabs/tailwindcss-intellisense

        // Try to find v4 CSS file or v3 config file
        let v4_css_path = Self::find_tailwind_v4_css(root);
        let v3_config_path = [
            "tailwind.config.js",
            "tailwind.config.ts",
            "tailwind.config.cjs",
            "tailwind.config.mjs",
        ]
        .iter()
        .find(|f| root.join(f).exists())
        .map(|f| root.join(f).to_string_lossy().to_string());

        // Use v4 CSS path if found, otherwise v3 config
        let config_file = v4_css_path.or(v3_config_path);

        if let Some(ref path) = config_file {
            info!("Tailwind config/CSS file found: {}", path);
            // Pass the configFile explicitly to help Tailwind LSP find the project
            // This is especially important for monorepos where auto-detection may fail
            serde_json::json!({
                "tailwindCSS": {
                    "experimental": {
                        "configFile": path
                    }
                }
            })
        } else {
            info!("No Tailwind config or v4 CSS file found - letting LSP auto-detect");
            serde_json::json!({})
        }
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true
                },
                "synchronization": {
                    "dynamicRegistration": true,
                    "didSave": true,
                    "willSave": false,
                    "willSaveWaitUntil": false
                },
                "hover": {
                    "dynamicRegistration": true,
                    "contentFormat": ["markdown", "plaintext"]
                },
                "completion": {
                    "dynamicRegistration": true,
                    "completionItem": {
                        "snippetSupport": true,
                        "documentationFormat": ["markdown", "plaintext"],
                        "resolveSupport": {
                            "properties": ["documentation", "detail"]
                        }
                    },
                    "contextSupport": true
                },
                "codeAction": {
                    "dynamicRegistration": true,
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": ["quickfix", "source"]
                        }
                    }
                },
                "colorProvider": {
                    "dynamicRegistration": true
                },
                "documentLink": {
                    "dynamicRegistration": true
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
            "tailwindCSS": {
                "validate": true,
                "emmetCompletions": true,
                "hovers": true,
                "suggestions": true,
                "codeActions": true,
                "colorDecorators": true,
                "includeLanguages": {
                    "javascript": "javascript",
                    "javascriptreact": "javascript",
                    "typescript": "javascript",
                    "typescriptreact": "javascript",
                    "html": "html",
                    "vue": "html",
                    "svelte": "html",
                    "astro": "html"
                },
                "classAttributes": ["class", "className", "classList", "ngClass"],
                "files": {
                    "exclude": ["**/.git/**", "**/node_modules/**", "**/.hg/**", "**/.svn/**"]
                },
                "lint": {
                    "cssConflict": "warning",
                    "invalidApply": "error",
                    "invalidScreen": "error",
                    "invalidVariant": "error",
                    "invalidConfigPath": "error",
                    "invalidTailwindDirective": "error",
                    "recommendedVariantOrder": "warning"
                },
                "experimental": {
                    "classRegex": [
                        ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
                        ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
                        ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
                        ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
                    ]
                }
            },
            "editor": {
                "tabSize": 2
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
            "svelte" => "svelte",
            "astro" => "astro",
            "html" | "htm" => "html",
            "css" => "css",
            "scss" => "scss",
            "less" => "less",
            _ => "plaintext",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "Tailwind CSS"
    }

    fn should_activate(&self, root: &PathBuf) -> bool {
        Self::has_tailwind(root)
    }
}

/// Type alias for Tailwind CSS LSP client
pub type TailwindCssLspClient = LspClient<TailwindCssConfig>;

/// Open file info for syncing with LSP
#[derive(Clone)]
struct OpenFile {
    path: PathBuf,
    content: String,
}

/// Tailwind CSS plugin state
pub struct TailwindCssPlugin {
    manifest: PluginManifest,
    ctx: Option<PluginContext>,
    lsp: Arc<RwLock<Option<TailwindCssLspClient>>>,
    project_root: Option<PathBuf>,
    config: TailwindCssConfig,
    /// Files that were opened before LSP was ready - will be synced when LSP starts
    pending_files: Arc<RwLock<Vec<OpenFile>>>,
}

impl TailwindCssPlugin {
    pub fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "panager.tailwindcss".to_string(),
                name: "Tailwind CSS".to_string(),
                version: "1.0.0".to_string(),
                description: "Tailwind CSS IntelliSense support".to_string(),
                // Tailwind works with many languages that use class attributes
                languages: vec![
                    "css".to_string(),
                    "scss".to_string(),
                    "less".to_string(),
                    "html".to_string(),
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
            config: TailwindCssConfig,
            pending_files: Arc::new(RwLock::new(Vec::new())),
        }
    }

    async fn stop_lsp(&mut self) {
        info!("Stopping Tailwind CSS LSP");

        if let Some(lsp) = self.lsp.write().await.take() {
            lsp.shutdown().await;
        }

        // Clear pending files
        self.pending_files.write().await.clear();

        self.project_root = None;

        if let Some(ref ctx) = self.ctx {
            ctx.remove_status_bar("tailwind-status".to_string());
        }
    }
}

impl Default for TailwindCssPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Plugin for TailwindCssPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String> {
        info!("Activating Tailwind CSS plugin");
        self.ctx = Some(ctx);
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<(), String> {
        info!("Deactivating Tailwind CSS plugin");
        self.stop_lsp().await;
        self.ctx = None;
        Ok(())
    }

    async fn on_event(&mut self, event: HostEvent) -> Result<(), String> {
        match event {
            HostEvent::ProjectOpened { path, .. } => {
                // Only start if tailwind is detected in the project
                if !TailwindCssConfig::has_tailwind(&path) {
                    debug!("No Tailwind CSS detected in project, skipping LSP start");
                    return Ok(());
                }

                self.project_root = Some(path.clone());
                let lsp = self.lsp.clone();
                let ctx = self.ctx.clone();
                let config = TailwindCssConfig;
                let pending_files = self.pending_files.clone();
                tokio::spawn(async move {
                    info!("Starting Tailwind CSS LSP for: {:?}", path);
                    match LspClient::start(&config, &path, ctx.clone().unwrap()).await {
                        Ok(client) => {
                            // Sync any files that were opened before LSP was ready
                            let files_to_sync = pending_files.write().await.drain(..).collect::<Vec<_>>();
                            for file in files_to_sync {
                                debug!("Syncing pending file to Tailwind LSP: {:?}", file.path);
                                client.did_open(&config, &file.path, &file.content).await;
                            }

                            *lsp.write().await = Some(client);
                            if let Some(ctx) = ctx {
                                ctx.update_status_bar(StatusBarItem {
                                    id: "tailwind-status".to_string(),
                                    text: "Tailwind".to_string(),
                                    tooltip: Some("Tailwind CSS IntelliSense active".to_string()),
                                    alignment: StatusBarAlignment::Right,
                                    priority: 47,
                                });
                            }
                        }
                        Err(e) => warn!("Failed to start Tailwind CSS LSP: {}", e),
                    }
                });
            }

            HostEvent::ProjectClosed => {
                self.stop_lsp().await;
            }

            HostEvent::FileOpened { path, content, language } => {
                debug!("Tailwind CSS plugin received FileOpened: {:?}, lang: {}", path, language);
                if let Some(lsp) = self.lsp.read().await.as_ref() {
                    lsp.did_open(&self.config, &path, &content).await;
                } else {
                    // LSP not ready yet, queue the file for later sync
                    debug!("Tailwind LSP not ready, queuing file: {:?}", path);
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
impl LspProvider for TailwindCssPlugin {
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
