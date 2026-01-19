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
    LspDocumentSymbol, LspHover, LspLocation, LspMarkupContent, LspPosition, LspRange,
    LspTextEdit, LspWorkspaceEdit,
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
    /// Plugin context for reporting diagnostics
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
                    Self::handle_message(&ctx_clone, &root_clone, &pending_clone, json).await;
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

    /// Send initialize request
    async fn initialize(&self) {
        let root_uri = format!("file://{}", self.root.display());

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": next_id(),
            "method": "initialize",
            "params": {
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
                        "workspaceFolders": true
                    }
                },
                "workspaceFolders": [{
                    "uri": root_uri,
                    "name": self.root.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "workspace".to_string())
                }]
            }
        });

        self.send(msg);

        // Send initialized notification after a short delay
        let stdin_tx = self.stdin_tx.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            let msg = serde_json::json!({
                "jsonrpc": "2.0",
                "method": "initialized",
                "params": {}
            });
            let _ = stdin_tx.send(msg.to_string());
        });
    }

    /// Handle incoming LSP message
    async fn handle_message(
        ctx: &PluginContext,
        _root: &PathBuf,
        pending: &Arc<RwLock<HashMap<u64, oneshot::Sender<serde_json::Value>>>>,
        msg: serde_json::Value,
    ) {
        // Check if this is a response to a request (has "id" and "result" or "error")
        if let Some(id) = msg.get("id").and_then(|id| id.as_u64()) {
            // This is a response
            if let Some(sender) = pending.write().await.remove(&id) {
                if let Some(result) = msg.get("result") {
                    let _ = sender.send(result.clone());
                } else if let Some(error) = msg.get("error") {
                    warn!("LSP error response for id {}: {:?}", id, error);
                    // Send null to indicate error
                    let _ = sender.send(serde_json::Value::Null);
                }
            }
            return;
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
                .map(|c| {
                    if c.is_number() {
                        c.as_u64().map(|n| n.to_string())
                    } else {
                        c.as_str().map(|s| s.to_string())
                    }
                })
                .flatten();

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

        if result.is_null() {
            return Ok(None);
        }

        Self::parse_hover(result)
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

        debug!("Requesting documentSymbol for URI: {}", uri);

        let result: serde_json::Value = self
            .request(
                "textDocument/documentSymbol",
                serde_json::json!({
                    "textDocument": { "uri": uri }
                }),
            )
            .await?;

        debug!("documentSymbol raw response: {:?}", result);

        Self::parse_document_symbols(result)
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
            .filter_map(|item| Self::parse_completion_item(item))
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

        Some(LspCompletionItem {
            label,
            kind,
            detail,
            documentation,
            insert_text,
            insert_text_format,
            sort_text,
            filter_text,
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
                            .filter_map(|e| Self::parse_text_edit(e))
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
            .filter_map(|item| Self::parse_document_symbol(item))
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
                    .filter_map(|child| Self::parse_document_symbol(child))
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
