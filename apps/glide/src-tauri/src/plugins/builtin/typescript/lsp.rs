//! LSP Client for TypeScript Language Server
//!
//! This module handles communication with typescript-language-server via JSON-RPC.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, RwLock};
use tracing::{debug, error, info, warn};
use serde::de::DeserializeOwned;

use crate::plugins::context::PluginContext;
use crate::plugins::types::{
    Diagnostic, DiagnosticSeverity, LspCodeAction, LspCompletionItem, LspCompletionList,
    LspDocumentHighlight, LspDocumentSymbol, LspFoldingRange, LspFormattingOptions, LspHover,
    LspInlayHint, LspInlayHintKind, LspLinkedEditingRanges, LspLocation, LspMarkupContent,
    LspParameterInformation, LspParameterLabel, LspPosition, LspRange, LspSelectionRange,
    LspSignatureHelp, LspSignatureInformation, LspTextEdit, LspWorkspaceEdit,
};

/// LSP message ID counter
static MESSAGE_ID: AtomicU64 = AtomicU64::new(1);

fn next_id() -> u64 {
    MESSAGE_ID.fetch_add(1, Ordering::SeqCst)
}

/// LSP Client for typescript-language-server
pub struct LspClient {
    /// Child process handle
    process: Arc<RwLock<Option<Child>>>,
    /// Stdin writer channel
    stdin_tx: mpsc::UnboundedSender<String>,
    /// Plugin context for reporting diagnostics (stored for future use)
    #[allow(dead_code)]
    ctx: PluginContext,
    /// Project root
    root: PathBuf,
    /// Document versions (for didChange)
    doc_versions: Arc<RwLock<HashMap<String, i32>>>,
    /// Pending requests awaiting responses
    pending_requests: Arc<RwLock<HashMap<u64, oneshot::Sender<serde_json::Value>>>>,
}

impl LspClient {
    /// Start the LSP server
    pub async fn start(root: &PathBuf, ctx: PluginContext) -> Result<Self, String> {
        info!("Starting typescript-language-server at {:?}", root);

        // Try to find and start the LSP server
        let mut child = Command::new("npx")
            .args(["typescript-language-server", "--stdio"])
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to start typescript-language-server: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or("Failed to open stdin")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("Failed to open stdout")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("Failed to open stderr")?;

        // Create channel for stdin writes
        let (stdin_tx, mut stdin_rx) = mpsc::unbounded_channel::<String>();

        // Spawn stdin writer task
        let mut stdin_writer = stdin;
        tokio::spawn(async move {
            while let Some(msg) = stdin_rx.recv().await {
                let header = format!("Content-Length: {}\r\n\r\n", msg.len());
                if let Err(e) = stdin_writer.write_all(header.as_bytes()).await {
                    error!("Failed to write LSP header: {}", e);
                    break;
                }
                if let Err(e) = stdin_writer.write_all(msg.as_bytes()).await {
                    error!("Failed to write LSP message: {}", e);
                    break;
                }
                if let Err(e) = stdin_writer.flush().await {
                    error!("Failed to flush LSP stdin: {}", e);
                    break;
                }
            }
        });

        // Create pending requests map
        let pending_requests: Arc<RwLock<HashMap<u64, oneshot::Sender<serde_json::Value>>>> =
            Arc::new(RwLock::new(HashMap::new()));

        // Spawn stdout reader task
        let ctx_clone = ctx.clone();
        let root_clone = root.clone();
        let pending_clone = pending_requests.clone();
        let stdin_tx_clone = stdin_tx.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut header_buf = String::new();

            loop {
                header_buf.clear();

                // Read Content-Length header
                match reader.read_line(&mut header_buf).await {
                    Ok(0) => {
                        debug!("LSP stdout EOF");
                        break;
                    }
                    Ok(_) => {}
                    Err(e) => {
                        error!("Failed to read LSP header: {}", e);
                        break;
                    }
                }

                // Parse content length
                let content_length = if header_buf.starts_with("Content-Length:") {
                    header_buf
                        .trim()
                        .strip_prefix("Content-Length:")
                        .and_then(|s| s.trim().parse::<usize>().ok())
                } else {
                    None
                };

                let Some(length) = content_length else {
                    continue;
                };

                // Read empty line
                header_buf.clear();
                if reader.read_line(&mut header_buf).await.is_err() {
                    break;
                }

                // Read content
                let mut content = vec![0u8; length];
                if let Err(e) = tokio::io::AsyncReadExt::read_exact(&mut reader, &mut content).await
                {
                    error!("Failed to read LSP content: {}", e);
                    break;
                }

                // Parse JSON
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&content) {
                    // Log all incoming messages for debugging
                    if let Some(method) = json.get("method").and_then(|m| m.as_str()) {
                        debug!("LSP incoming notification: {}", method);
                    } else if let Some(id) = json.get("id") {
                        debug!("LSP incoming response for id: {:?}, has_result: {}, has_error: {}",
                            id, json.get("result").is_some(), json.get("error").is_some());
                    }
                    Self::handle_message(&ctx_clone, &root_clone, &pending_clone, json, &stdin_tx_clone).await;
                } else {
                    warn!("LSP failed to parse JSON response");
                }
            }
        });

        // Spawn stderr reader task
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        if !line.trim().is_empty() {
                            debug!("LSP stderr: {}", line.trim());
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        let client = Self {
            process: Arc::new(RwLock::new(Some(child))),
            stdin_tx,
            ctx,
            root: root.clone(),
            doc_versions: Arc::new(RwLock::new(HashMap::new())),
            pending_requests,
        };

        // Send initialize request
        client.initialize().await;

        Ok(client)
    }

    /// Send initialize request and wait for response
    async fn initialize(&self) {
        let root_uri = format!("file://{}", self.root.display());

        let params = serde_json::json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": {
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
                    "documentSymbol": {
                        "hierarchicalDocumentSymbolSupport": true,
                        "symbolKind": {
                            "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                        }
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
                    "definition": {
                        "linkSupport": true
                    },
                    "references": {},
                    "rename": {
                        "prepareSupport": true
                    },
                    "codeAction": {
                        "codeActionLiteralSupport": {
                            "codeActionKind": {
                                "valueSet": ["quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"]
                            }
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
            },
            "workspaceFolders": [{
                "uri": root_uri,
                "name": self.root.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "workspace".to_string())
            }],
            "initializationOptions": {
                "hostInfo": "Panager IDE",
                "tsserver": {
                    "useSyntaxServer": "auto",
                    "logVerbosity": "off"
                },
                "preferences": {
                    "importModuleSpecifierPreference": "shortest",
                    "includePackageJsonAutoImports": "auto",
                    "allowIncompleteCompletions": true,
                    "includeCompletionsForModuleExports": true
                },
                "disableAutomaticTypingAcquisition": false
            }
        });

        // Send initialize request and wait for response (with longer timeout for cold start)
        let result: Result<serde_json::Value, String> = self
            .request_with_timeout("initialize", params, Duration::from_secs(30))
            .await;

        match result {
            Ok(capabilities) => {
                info!("LSP initialized successfully, capabilities: {:?}",
                    capabilities.get("capabilities").map(|c| c.to_string().chars().take(200).collect::<String>()));
            }
            Err(e) => {
                error!("LSP initialize failed: {}", e);
                return;
            }
        }

        // NOW send initialized notification (after receiving initialize response)
        let initialized_msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        });
        self.send(initialized_msg);
        debug!("Sent initialized notification");

        // Send workspace configuration with balanced defaults for inlay hints
        // Note: Settings are loaded at LSP startup. Changing settings requires project restart.
        let config_msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "workspace/didChangeConfiguration",
            "params": {
                "settings": {
                    "typescript": {
                        "inlayHints": {
                            "includeInlayParameterNameHints": "literals",
                            "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
                            "includeInlayFunctionParameterTypeHints": false,
                            "includeInlayVariableTypeHints": false,
                            "includeInlayPropertyDeclarationTypeHints": false,
                            "includeInlayFunctionLikeReturnTypeHints": true,
                            "includeInlayEnumMemberValueHints": true
                        },
                        "preferences": {
                            "importModuleSpecifierPreference": "shortest",
                            "includePackageJsonAutoImports": "auto"
                        },
                        "tsserver": {
                            "enableProjectDiagnostics": true
                        }
                    },
                    "javascript": {
                        "inlayHints": {
                            "includeInlayParameterNameHints": "literals",
                            "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
                            "includeInlayFunctionParameterTypeHints": false,
                            "includeInlayVariableTypeHints": false,
                            "includeInlayPropertyDeclarationTypeHints": false,
                            "includeInlayFunctionLikeReturnTypeHints": true,
                            "includeInlayEnumMemberValueHints": true
                        },
                        "preferences": {
                            "importModuleSpecifierPreference": "shortest",
                            "includePackageJsonAutoImports": "auto"
                        }
                    }
                }
            }
        });
        self.send(config_msg);
        debug!("Sent workspace configuration");
    }

    /// Send a request with a custom timeout
    async fn request_with_timeout<T: DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
        timeout: Duration,
    ) -> Result<T, String> {
        let id = next_id();
        let (tx, rx) = oneshot::channel();

        // Register pending request
        self.pending_requests.write().await.insert(id, tx);

        debug!("LSP request id={} method={}", id, method);

        // Send request
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        self.send(request);

        // Wait for response with custom timeout
        let response = tokio::time::timeout(timeout, rx)
            .await
            .map_err(|_| format!("LSP request '{}' timed out after {:?}", method, timeout))?
            .map_err(|_| "LSP response channel closed".to_string())?;

        // Handle null response (error case)
        if response.is_null() {
            return Err(format!("LSP request '{}' returned error", method));
        }

        // Parse result
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse LSP response for '{}': {}", method, e))
    }

    /// Handle incoming LSP message
    async fn handle_message(
        ctx: &PluginContext,
        _root: &PathBuf,
        pending: &Arc<RwLock<HashMap<u64, oneshot::Sender<serde_json::Value>>>>,
        msg: serde_json::Value,
        stdin_tx: &mpsc::UnboundedSender<String>,
    ) {
        // Check if this is a request FROM the server (has "id" and "method")
        if let (Some(id), Some(method)) = (msg.get("id"), msg.get("method").and_then(|m| m.as_str())) {
            debug!("LSP server request: method={}, id={:?}", method, id);

            // Handle workspace/configuration request - server asking for config
            if method == "workspace/configuration" {
                let items = msg.get("params")
                    .and_then(|p| p.get("items"))
                    .and_then(|i| i.as_array())
                    .map(|arr| arr.len())
                    .unwrap_or(0);

                // Respond with configuration for each requested item
                // The server expects an array of config objects, one per item requested
                // Using balanced defaults for inlay hints
                let config_response: Vec<serde_json::Value> = (0..items)
                    .map(|_| {
                        serde_json::json!({
                            "inlayHints": {
                                "includeInlayParameterNameHints": "literals",
                                "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
                                "includeInlayFunctionParameterTypeHints": false,
                                "includeInlayVariableTypeHints": false,
                                "includeInlayPropertyDeclarationTypeHints": false,
                                "includeInlayFunctionLikeReturnTypeHints": true,
                                "includeInlayEnumMemberValueHints": true
                            },
                            "preferences": {
                                "importModuleSpecifierPreference": "shortest",
                                "includePackageJsonAutoImports": "auto"
                            }
                        })
                    })
                    .collect();

                let response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": config_response
                });

                debug!("LSP responding to workspace/configuration with {} items", items);
                let _ = stdin_tx.send(response.to_string());
                return;
            }

            // Handle other server requests we don't support - respond with null
            if method == "window/workDoneProgress/create" {
                let response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": null
                });
                let _ = stdin_tx.send(response.to_string());
                return;
            }

            // Unknown server request - log it
            debug!("LSP unhandled server request: {}", method);
            return;
        }

        // Check if this is a response to a request (has "id" and "result" or "error", but no "method")
        if let Some(id_value) = msg.get("id") {
            if msg.get("method").is_none() {
                // Parse ID - could be number or string
                let id: Option<u64> = if let Some(n) = id_value.as_u64() {
                    Some(n)
                } else if let Some(n) = id_value.as_i64() {
                    Some(n as u64)
                } else if let Some(s) = id_value.as_str() {
                    s.parse().ok()
                } else {
                    None
                };

                if let Some(id) = id {
                    // This is a response
                    let has_result = msg.get("result").is_some();
                    let has_error = msg.get("error").is_some();

                    if has_result || has_error {
                        if let Some(sender) = pending.write().await.remove(&id) {
                            if let Some(result) = msg.get("result") {
                                debug!("LSP response received for id {}", id);
                                let _ = sender.send(result.clone());
                            } else if let Some(error) = msg.get("error") {
                                warn!("LSP error response for id {}: {:?}", id, error);
                                // Send null to indicate error
                                let _ = sender.send(serde_json::Value::Null);
                            }
                        } else {
                            debug!("LSP response for unknown id {}: has_result={}, has_error={}", id, has_result, has_error);
                        }
                        return;
                    }
                }
            }
        }

        // Check for diagnostics notification
        if msg.get("method") == Some(&serde_json::json!("textDocument/publishDiagnostics")) {
            if let Some(params) = msg.get("params") {
                Self::handle_diagnostics(ctx, params).await;
            }
        }
    }

    /// Handle publishDiagnostics notification
    async fn handle_diagnostics(ctx: &PluginContext, params: &serde_json::Value) {
        let Some(uri) = params.get("uri").and_then(|u| u.as_str()) else {
            return;
        };

        let file_path = uri
            .strip_prefix("file://")
            .unwrap_or(uri)
            .to_string();

        let diagnostics_json = params
            .get("diagnostics")
            .and_then(|d| d.as_array())
            .map(|arr| arr.to_vec())
            .unwrap_or_default();

        let mut diagnostics = Vec::new();

        for (idx, diag) in diagnostics_json.iter().enumerate() {
            let message = diag
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_string();

            let severity = diag
                .get("severity")
                .and_then(|s| s.as_u64())
                .map(|s| DiagnosticSeverity::from_lsp(s as u32))
                .unwrap_or(DiagnosticSeverity::Error);

            let range = diag.get("range");
            let start = range.and_then(|r| r.get("start"));
            let end = range.and_then(|r| r.get("end"));

            let start_line = start
                .and_then(|s| s.get("line"))
                .and_then(|l| l.as_u64())
                .unwrap_or(0) as u32
                + 1; // LSP is 0-indexed
            let start_column = start
                .and_then(|s| s.get("character"))
                .and_then(|c| c.as_u64())
                .unwrap_or(0) as u32
                + 1;
            let end_line = end
                .and_then(|e| e.get("line"))
                .and_then(|l| l.as_u64())
                .unwrap_or(0) as u32
                + 1;
            let end_column = end
                .and_then(|e| e.get("character"))
                .and_then(|c| c.as_u64())
                .unwrap_or(0) as u32
                + 1;

            let code = diag
                .get("code")
                .and_then(|c| {
                    if c.is_number() {
                        c.as_u64().map(|n| n.to_string())
                    } else {
                        c.as_str().map(|s| s.to_string())
                    }
                });

            diagnostics.push(Diagnostic {
                id: format!("ts-{}-{}", file_path, idx),
                file_path: file_path.clone(),
                severity,
                message,
                source: "TypeScript".to_string(),
                code,
                start_line,
                start_column,
                end_line,
                end_column,
            });
        }

        debug!(
            "Publishing {} diagnostics for {}",
            diagnostics.len(),
            file_path
        );
        ctx.report_diagnostics(file_path, diagnostics);
    }

    /// Send a JSON-RPC message
    fn send(&self, msg: serde_json::Value) {
        let _ = self.stdin_tx.send(msg.to_string());
    }

    /// Send a request and wait for response
    pub async fn request<T: DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T, String> {
        let id = next_id();
        let (tx, rx) = oneshot::channel();

        // Register pending request
        self.pending_requests.write().await.insert(id, tx);

        debug!("LSP request id={} method={}", id, method);

        // Send request
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        self.send(request);

        // Wait for response with timeout
        let response = tokio::time::timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| format!("LSP request '{}' timed out", method))?
            .map_err(|_| "LSP response channel closed".to_string())?;

        // Handle null response (error case)
        if response.is_null() {
            return Err(format!("LSP request '{}' returned error", method));
        }

        // Parse result
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse LSP response for '{}': {}", method, e))
    }

    // =========================================================================
    // LSP Request Methods
    // =========================================================================

    /// Go to definition
    pub async fn goto_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/definition",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        // Definition can return Location, Location[], or LocationLink[]
        Self::parse_locations(result)
    }

    /// Get hover information
    pub async fn hover(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspHover>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/hover",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        debug!("LSP hover raw result: {}", result.to_string().chars().take(500).collect::<String>());

        if result.is_null() {
            debug!("LSP hover result is null");
            return Ok(None);
        }

        let parsed = Self::parse_hover(result);
        debug!("LSP hover parsed result: {:?}", parsed.as_ref().map(|r| r.as_ref().map(|h| h.contents.value.chars().take(100).collect::<String>())));
        parsed
    }

    /// Get completions
    pub async fn completion(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<LspCompletionList, String> {
        let uri = format!("file://{}", path.display());

        let mut params = serde_json::json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        if let Some(trigger) = trigger_character {
            params["context"] = serde_json::json!({
                "triggerKind": 2, // TriggerCharacter
                "triggerCharacter": trigger
            });
        }

        let result: serde_json::Value = self.request("textDocument/completion", params).await?;

        Self::parse_completion_list(result)
    }

    /// Find references
    pub async fn references(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        include_declaration: bool,
    ) -> Result<Vec<LspLocation>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/references",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character },
                    "context": { "includeDeclaration": include_declaration }
                }),
            )
            .await?;

        Self::parse_locations(result)
    }

    /// Rename symbol
    pub async fn rename(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        new_name: &str,
    ) -> Result<LspWorkspaceEdit, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/rename",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character },
                    "newName": new_name
                }),
            )
            .await?;

        Self::parse_workspace_edit(result)
    }

    /// Get code actions
    pub async fn code_action(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        diagnostics: Vec<serde_json::Value>,
    ) -> Result<Vec<LspCodeAction>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/codeAction",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "range": {
                        "start": { "line": start_line, "character": start_character },
                        "end": { "line": end_line, "character": end_character }
                    },
                    "context": { "diagnostics": diagnostics }
                }),
            )
            .await?;

        Self::parse_code_actions(result)
    }

    /// Get document symbols (functions, classes, etc.)
    pub async fn document_symbols(
        &self,
        path: &PathBuf,
    ) -> Result<Vec<LspDocumentSymbol>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/documentSymbol",
                serde_json::json!({
                    "textDocument": { "uri": uri }
                }),
            )
            .await?;

        Self::parse_document_symbols(result)
    }

    /// Get inlay hints for a range
    pub async fn inlay_hints(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
    ) -> Result<Vec<LspInlayHint>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/inlayHint",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "range": {
                        "start": { "line": start_line, "character": start_character },
                        "end": { "line": end_line, "character": end_character }
                    }
                }),
            )
            .await?;

        Self::parse_inlay_hints(result)
    }

    /// Get document highlights (highlight all occurrences of symbol)
    pub async fn document_highlight(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspDocumentHighlight>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/documentHighlight",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        Self::parse_document_highlights(result)
    }

    /// Get signature help (parameter hints)
    pub async fn signature_help(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<Option<LspSignatureHelp>, String> {
        let uri = format!("file://{}", path.display());

        let mut params = serde_json::json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        if let Some(trigger) = trigger_character {
            params["context"] = serde_json::json!({
                "triggerKind": 2, // TriggerCharacter
                "triggerCharacter": trigger,
                "isRetrigger": false
            });
        }

        let result: serde_json::Value = self.request("textDocument/signatureHelp", params).await?;

        Self::parse_signature_help(result)
    }

    /// Format entire document
    pub async fn format_document(
        &self,
        path: &PathBuf,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/formatting",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "options": {
                        "tabSize": options.tab_size,
                        "insertSpaces": options.insert_spaces
                    }
                }),
            )
            .await?;

        Self::parse_text_edits(result)
    }

    /// Format a range in document
    pub async fn format_range(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/rangeFormatting",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "range": {
                        "start": { "line": start_line, "character": start_character },
                        "end": { "line": end_line, "character": end_character }
                    },
                    "options": {
                        "tabSize": options.tab_size,
                        "insertSpaces": options.insert_spaces
                    }
                }),
            )
            .await?;

        Self::parse_text_edits(result)
    }

    /// Format on type
    pub async fn format_on_type(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: &str,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/onTypeFormatting",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character },
                    "ch": trigger_character,
                    "options": {
                        "tabSize": options.tab_size,
                        "insertSpaces": options.insert_spaces
                    }
                }),
            )
            .await?;

        Self::parse_text_edits(result)
    }

    /// Go to type definition
    pub async fn type_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/typeDefinition",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        Self::parse_locations(result)
    }

    /// Go to implementation
    pub async fn implementation(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/implementation",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        Self::parse_locations(result)
    }

    /// Get folding ranges
    pub async fn folding_range(&self, path: &PathBuf) -> Result<Vec<LspFoldingRange>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/foldingRange",
                serde_json::json!({
                    "textDocument": { "uri": uri }
                }),
            )
            .await?;

        Self::parse_folding_ranges(result)
    }

    /// Get selection ranges (smart select)
    pub async fn selection_range(
        &self,
        path: &PathBuf,
        positions: Vec<LspPosition>,
    ) -> Result<Vec<LspSelectionRange>, String> {
        let uri = format!("file://{}", path.display());

        let lsp_positions: Vec<_> = positions
            .iter()
            .map(|p| {
                serde_json::json!({
                    "line": p.line,
                    "character": p.character
                })
            })
            .collect();

        let result: serde_json::Value = self
            .request(
                "textDocument/selectionRange",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "positions": lsp_positions
                }),
            )
            .await?;

        Self::parse_selection_ranges(result)
    }

    /// Get linked editing ranges (tag renaming)
    pub async fn linked_editing_range(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspLinkedEditingRanges>, String> {
        let uri = format!("file://{}", path.display());

        let result: serde_json::Value = self
            .request(
                "textDocument/linkedEditingRange",
                serde_json::json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character }
                }),
            )
            .await?;

        Self::parse_linked_editing_ranges(result)
    }

    // =========================================================================
    // Response Parsing Helpers
    // =========================================================================

    fn parse_locations(value: serde_json::Value) -> Result<Vec<LspLocation>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        // Single location
        if value.is_object() {
            if let Some(loc) = Self::parse_location(&value) {
                return Ok(vec![loc]);
            }
            // Could be a LocationLink
            if let Some(target_uri) = value.get("targetUri").and_then(|v| v.as_str()) {
                if let Some(range) = value.get("targetRange").or(value.get("targetSelectionRange")) {
                    if let Some(range) = Self::parse_range(range) {
                        return Ok(vec![LspLocation {
                            uri: target_uri.to_string(),
                            range,
                        }]);
                    }
                }
            }
        }

        // Array of locations
        if let Some(arr) = value.as_array() {
            let mut locations = Vec::new();
            for item in arr {
                if let Some(loc) = Self::parse_location(item) {
                    locations.push(loc);
                } else if let Some(target_uri) = item.get("targetUri").and_then(|v| v.as_str()) {
                    // LocationLink
                    if let Some(range) = item.get("targetRange").or(item.get("targetSelectionRange"))
                    {
                        if let Some(range) = Self::parse_range(range) {
                            locations.push(LspLocation {
                                uri: target_uri.to_string(),
                                range,
                            });
                        }
                    }
                }
            }
            return Ok(locations);
        }

        Ok(vec![])
    }

    fn parse_location(value: &serde_json::Value) -> Option<LspLocation> {
        let uri = value.get("uri")?.as_str()?.to_string();
        let range = Self::parse_range(value.get("range")?)?;
        Some(LspLocation { uri, range })
    }

    fn parse_range(value: &serde_json::Value) -> Option<LspRange> {
        let start = Self::parse_position(value.get("start")?)?;
        let end = Self::parse_position(value.get("end")?)?;
        Some(LspRange { start, end })
    }

    fn parse_position(value: &serde_json::Value) -> Option<LspPosition> {
        let line = value.get("line")?.as_u64()? as u32;
        let character = value.get("character")?.as_u64()? as u32;
        Some(LspPosition { line, character })
    }

    fn parse_hover(value: serde_json::Value) -> Result<Option<LspHover>, String> {
        let contents = value.get("contents");
        if contents.is_none() {
            return Ok(None);
        }

        let contents = contents.unwrap();
        let markup = Self::parse_markup_content(contents)?;

        let range = value.get("range").and_then(Self::parse_range);

        Ok(Some(LspHover {
            contents: markup,
            range,
        }))
    }

    fn parse_markup_content(value: &serde_json::Value) -> Result<LspMarkupContent, String> {
        // String content
        if let Some(s) = value.as_str() {
            return Ok(LspMarkupContent {
                kind: "plaintext".to_string(),
                value: s.to_string(),
            });
        }

        // MarkupContent object
        if value.is_object() {
            if let (Some(kind), Some(val)) = (
                value.get("kind").and_then(|k| k.as_str()),
                value.get("value").and_then(|v| v.as_str()),
            ) {
                return Ok(LspMarkupContent {
                    kind: kind.to_string(),
                    value: val.to_string(),
                });
            }
            // MarkedString { language, value }
            if let Some(val) = value.get("value").and_then(|v| v.as_str()) {
                let lang = value
                    .get("language")
                    .and_then(|l| l.as_str())
                    .unwrap_or("text");
                return Ok(LspMarkupContent {
                    kind: "markdown".to_string(),
                    value: format!("```{}\n{}\n```", lang, val),
                });
            }
        }

        // Array of MarkedString
        if let Some(arr) = value.as_array() {
            let parts: Vec<String> = arr
                .iter()
                .filter_map(|item| {
                    if let Some(s) = item.as_str() {
                        Some(s.to_string())
                    } else if let Some(val) = item.get("value").and_then(|v| v.as_str()) {
                        let lang = item
                            .get("language")
                            .and_then(|l| l.as_str())
                            .unwrap_or("text");
                        Some(format!("```{}\n{}\n```", lang, val))
                    } else {
                        None
                    }
                })
                .collect();
            return Ok(LspMarkupContent {
                kind: "markdown".to_string(),
                value: parts.join("\n\n"),
            });
        }

        Ok(LspMarkupContent {
            kind: "plaintext".to_string(),
            value: String::new(),
        })
    }

    fn parse_completion_list(value: serde_json::Value) -> Result<LspCompletionList, String> {
        // Could be CompletionList or CompletionItem[]
        let (is_incomplete, items) = if let Some(arr) = value.as_array() {
            (false, arr.clone())
        } else {
            let is_incomplete = value
                .get("isIncomplete")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let items = value
                .get("items")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            (is_incomplete, items)
        };

        let items: Vec<LspCompletionItem> = items
            .iter()
            .filter_map(Self::parse_completion_item)
            .collect();

        Ok(LspCompletionList {
            is_incomplete,
            items,
        })
    }

    fn parse_completion_item(value: &serde_json::Value) -> Option<LspCompletionItem> {
        let label = value.get("label")?.as_str()?.to_string();
        let kind = value.get("kind").and_then(|k| k.as_u64()).map(|k| k as u32);
        let detail = value
            .get("detail")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string());
        let documentation = value.get("documentation").and_then(|d| {
            if d.is_string() {
                Some(LspMarkupContent {
                    kind: "plaintext".to_string(),
                    value: d.as_str().unwrap().to_string(),
                })
            } else {
                Self::parse_markup_content(d).ok()
            }
        });
        let insert_text = value
            .get("insertText")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());
        let insert_text_format = value
            .get("insertTextFormat")
            .and_then(|f| f.as_u64())
            .map(|f| f as u32);
        let sort_text = value
            .get("sortText")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());
        let filter_text = value
            .get("filterText")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());
        // Parse textEdit - can be TextEdit or InsertReplaceEdit
        let text_edit = value.get("textEdit").and_then(|te| {
            // Try standard TextEdit format first
            if te.get("range").is_some() {
                Self::parse_text_edit(te)
            } else if let Some(insert) = te.get("insert") {
                // InsertReplaceEdit - use insert range
                let new_text = te.get("newText")?.as_str()?.to_string();
                Some(LspTextEdit {
                    range: Self::parse_range(insert)?,
                    new_text,
                })
            } else {
                None
            }
        });

        Some(LspCompletionItem {
            label,
            kind,
            detail,
            documentation,
            insert_text,
            insert_text_format,
            sort_text,
            filter_text,
            text_edit,
        })
    }

    fn parse_workspace_edit(value: serde_json::Value) -> Result<LspWorkspaceEdit, String> {
        let changes = value.get("changes").and_then(|c| {
            if let Some(obj) = c.as_object() {
                let mut map = HashMap::new();
                for (uri, edits) in obj {
                    if let Some(arr) = edits.as_array() {
                        let text_edits: Vec<LspTextEdit> = arr
                            .iter()
                            .filter_map(Self::parse_text_edit)
                            .collect();
                        map.insert(uri.clone(), text_edits);
                    }
                }
                Some(map)
            } else {
                None
            }
        });

        // TODO: Parse documentChanges if needed

        Ok(LspWorkspaceEdit {
            changes,
            document_changes: None,
        })
    }

    fn parse_text_edit(value: &serde_json::Value) -> Option<LspTextEdit> {
        let range = Self::parse_range(value.get("range")?)?;
        let new_text = value.get("newText")?.as_str()?.to_string();
        Some(LspTextEdit { range, new_text })
    }

    fn parse_code_actions(value: serde_json::Value) -> Result<Vec<LspCodeAction>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of code actions")?;

        let actions: Vec<LspCodeAction> = arr
            .iter()
            .filter_map(|item| {
                let title = item.get("title")?.as_str()?.to_string();
                let kind = item
                    .get("kind")
                    .and_then(|k| k.as_str())
                    .map(|s| s.to_string());
                let is_preferred = item.get("isPreferred").and_then(|p| p.as_bool());
                let edit = item
                    .get("edit")
                    .and_then(|e| Self::parse_workspace_edit(e.clone()).ok());

                Some(LspCodeAction {
                    title,
                    kind,
                    is_preferred,
                    edit,
                    diagnostics: None,
                    command: None,
                })
            })
            .collect();

        Ok(actions)
    }

    fn parse_document_symbols(value: serde_json::Value) -> Result<Vec<LspDocumentSymbol>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of document symbols")?;

        let symbols: Vec<LspDocumentSymbol> = arr
            .iter()
            .filter_map(Self::parse_document_symbol)
            .collect();

        Ok(symbols)
    }

    fn parse_document_symbol(value: &serde_json::Value) -> Option<LspDocumentSymbol> {
        let name = value.get("name")?.as_str()?.to_string();
        let kind = value.get("kind")?.as_u64()? as u32;
        let range = Self::parse_range(value.get("range")?)?;
        let selection_range = Self::parse_range(value.get("selectionRange")?)?;
        let detail = value.get("detail").and_then(|d| d.as_str()).map(|s| s.to_string());
        let children = value.get("children").and_then(|c| {
            c.as_array().map(|arr| {
                arr.iter()
                    .filter_map(Self::parse_document_symbol)
                    .collect()
            })
        });

        Some(LspDocumentSymbol {
            name,
            kind,
            range,
            selection_range,
            detail,
            children,
        })
    }

    fn parse_inlay_hints(value: serde_json::Value) -> Result<Vec<LspInlayHint>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of inlay hints")?;

        let hints: Vec<LspInlayHint> = arr
            .iter()
            .filter_map(Self::parse_inlay_hint)
            .collect();

        Ok(hints)
    }

    fn parse_inlay_hint(value: &serde_json::Value) -> Option<LspInlayHint> {
        let position = Self::parse_position(value.get("position")?)?;

        // Label can be a string or an array of InlayHintLabelPart
        let label = if let Some(s) = value.get("label").and_then(|l| l.as_str()) {
            s.to_string()
        } else if let Some(arr) = value.get("label").and_then(|l| l.as_array()) {
            // Concatenate all label parts
            arr.iter()
                .filter_map(|part| part.get("value").and_then(|v| v.as_str()))
                .collect::<Vec<_>>()
                .join("")
        } else {
            return None;
        };

        // Kind: 1 = Type, 2 = Parameter
        let kind = value.get("kind").and_then(|k| k.as_u64()).map(|k| match k {
            1 => LspInlayHintKind::Type,
            2 => LspInlayHintKind::Parameter,
            _ => LspInlayHintKind::Type,
        });

        let padding_left = value.get("paddingLeft").and_then(|p| p.as_bool());
        let padding_right = value.get("paddingRight").and_then(|p| p.as_bool());

        Some(LspInlayHint {
            position,
            label,
            kind,
            padding_left,
            padding_right,
        })
    }

    fn parse_document_highlights(
        value: serde_json::Value,
    ) -> Result<Vec<LspDocumentHighlight>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of highlights")?;
        let highlights: Vec<LspDocumentHighlight> = arr
            .iter()
            .filter_map(|item| {
                let range = Self::parse_range(item.get("range")?)?;
                let kind = item.get("kind").and_then(|k| k.as_u64()).map(|k| k as u32);
                Some(LspDocumentHighlight { range, kind })
            })
            .collect();

        Ok(highlights)
    }

    fn parse_signature_help(
        value: serde_json::Value,
    ) -> Result<Option<LspSignatureHelp>, String> {
        if value.is_null() {
            return Ok(None);
        }

        let signatures_arr = value
            .get("signatures")
            .and_then(|s| s.as_array())
            .ok_or("Expected signatures array")?;

        let signatures: Vec<LspSignatureInformation> = signatures_arr
            .iter()
            .filter_map(|sig| {
                let label = sig.get("label")?.as_str()?.to_string();
                let documentation = sig
                    .get("documentation")
                    .and_then(|d| Self::parse_markup_content(d).ok());
                let parameters = sig.get("parameters").and_then(|p| p.as_array()).map(|arr| {
                    arr.iter()
                        .filter_map(|param| {
                            let label = Self::parse_parameter_label(param.get("label")?)?;
                            let documentation = param
                                .get("documentation")
                                .and_then(|d| Self::parse_markup_content(d).ok());
                            Some(LspParameterInformation {
                                label,
                                documentation,
                            })
                        })
                        .collect()
                });
                let active_parameter = sig
                    .get("activeParameter")
                    .and_then(|a| a.as_u64())
                    .map(|a| a as u32);

                Some(LspSignatureInformation {
                    label,
                    documentation,
                    parameters,
                    active_parameter,
                })
            })
            .collect();

        let active_signature = value
            .get("activeSignature")
            .and_then(|a| a.as_u64())
            .map(|a| a as u32);
        let active_parameter = value
            .get("activeParameter")
            .and_then(|a| a.as_u64())
            .map(|a| a as u32);

        Ok(Some(LspSignatureHelp {
            signatures,
            active_signature,
            active_parameter,
        }))
    }

    fn parse_parameter_label(value: &serde_json::Value) -> Option<LspParameterLabel> {
        if let Some(s) = value.as_str() {
            return Some(LspParameterLabel::String(s.to_string()));
        }
        if let Some(arr) = value.as_array() {
            if arr.len() == 2 {
                let start = arr[0].as_u64()? as u32;
                let end = arr[1].as_u64()? as u32;
                return Some(LspParameterLabel::Offsets([start, end]));
            }
        }
        None
    }

    fn parse_text_edits(value: serde_json::Value) -> Result<Vec<LspTextEdit>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of text edits")?;
        let edits: Vec<LspTextEdit> = arr
            .iter()
            .filter_map(Self::parse_text_edit)
            .collect();

        Ok(edits)
    }

    fn parse_folding_ranges(value: serde_json::Value) -> Result<Vec<LspFoldingRange>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of folding ranges")?;
        let ranges: Vec<LspFoldingRange> = arr
            .iter()
            .filter_map(|item| {
                let start_line = item.get("startLine")?.as_u64()? as u32;
                let end_line = item.get("endLine")?.as_u64()? as u32;
                let start_character = item
                    .get("startCharacter")
                    .and_then(|c| c.as_u64())
                    .map(|c| c as u32);
                let end_character = item
                    .get("endCharacter")
                    .and_then(|c| c.as_u64())
                    .map(|c| c as u32);
                let kind = item.get("kind").and_then(|k| k.as_str()).map(|s| s.to_string());

                Some(LspFoldingRange {
                    start_line,
                    start_character,
                    end_line,
                    end_character,
                    kind,
                })
            })
            .collect();

        Ok(ranges)
    }

    fn parse_selection_ranges(value: serde_json::Value) -> Result<Vec<LspSelectionRange>, String> {
        if value.is_null() {
            return Ok(vec![]);
        }

        let arr = value.as_array().ok_or("Expected array of selection ranges")?;
        let ranges: Vec<LspSelectionRange> = arr
            .iter()
            .filter_map(Self::parse_selection_range)
            .collect();

        Ok(ranges)
    }

    fn parse_selection_range(value: &serde_json::Value) -> Option<LspSelectionRange> {
        let range = Self::parse_range(value.get("range")?)?;
        let parent = value
            .get("parent")
            .and_then(Self::parse_selection_range)
            .map(Box::new);

        Some(LspSelectionRange { range, parent })
    }

    fn parse_linked_editing_ranges(
        value: serde_json::Value,
    ) -> Result<Option<LspLinkedEditingRanges>, String> {
        if value.is_null() {
            return Ok(None);
        }

        let ranges_arr = value
            .get("ranges")
            .and_then(|r| r.as_array())
            .ok_or("Expected ranges array")?;

        let ranges: Vec<LspRange> = ranges_arr
            .iter()
            .filter_map(Self::parse_range)
            .collect();

        let word_pattern = value
            .get("wordPattern")
            .and_then(|w| w.as_str())
            .map(|s| s.to_string());

        Ok(Some(LspLinkedEditingRanges {
            ranges,
            word_pattern,
        }))
    }

    // =========================================================================
    // Document Notifications
    // =========================================================================

    /// Notify server that a document was opened
    pub async fn did_open(&self, path: &PathBuf, content: &str, language: &str) {
        let uri = format!("file://{}", path.display());

        // Map language to LSP language ID
        let language_id = match language {
            "typescriptreact" => "typescriptreact",
            "javascriptreact" => "javascriptreact",
            "javascript" => "javascript",
            _ => "typescript",
        };

        debug!("LSP didOpen: uri={}, languageId={}, content_len={}", uri, language_id, content.len());

        // Store version
        self.doc_versions.write().await.insert(uri.clone(), 1);

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": uri,
                    "languageId": language_id,
                    "version": 1,
                    "text": content
                }
            }
        });

        self.send(msg);
    }

    /// Notify server that a document was closed
    pub async fn did_close(&self, path: &PathBuf) {
        let uri = format!("file://{}", path.display());

        self.doc_versions.write().await.remove(&uri);

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didClose",
            "params": {
                "textDocument": {
                    "uri": uri
                }
            }
        });

        self.send(msg);
    }

    /// Notify server that a document changed
    pub async fn did_change(&self, path: &PathBuf, content: &str) {
        let uri = format!("file://{}", path.display());

        // Increment version
        let version = {
            let mut versions = self.doc_versions.write().await;
            let v = versions.entry(uri.clone()).or_insert(0);
            *v += 1;
            *v
        };

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didChange",
            "params": {
                "textDocument": {
                    "uri": uri,
                    "version": version
                },
                "contentChanges": [{
                    "text": content
                }]
            }
        });

        self.send(msg);
    }

    /// Notify server that a document was saved
    pub async fn did_save(&self, path: &PathBuf) {
        let uri = format!("file://{}", path.display());

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didSave",
            "params": {
                "textDocument": {
                    "uri": uri
                }
            }
        });

        self.send(msg);
    }

    /// Shutdown the LSP server
    pub async fn shutdown(self) {
        info!("Shutting down TypeScript LSP");

        // Send shutdown request
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": next_id(),
            "method": "shutdown",
            "params": null
        });
        self.send(msg);

        // Send exit notification
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "exit",
            "params": null
        });
        self.send(msg);

        // Wait a bit then kill if still running
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        if let Some(mut child) = self.process.write().await.take() {
            let _ = child.kill().await;
        }
    }
}
