//! ACP Process Management using the official agent-client-protocol SDK
//!
//! Handles spawning and managing the claude-code-acp child process.
//!
//! IMPORTANT: This file implements the Entry Processing Rules.
//! The frontend (useAcpEvents.ts) MUST use the same logic for processing events.
//! See: src/ide/docs/ENTRY_PROCESSING_RULES.md
//!
//! The agent-client-protocol SDK uses `#[async_trait(?Send)]` which means its futures
//! are not Send-safe. Since Tauri uses a multi-threaded Tokio runtime with Send
//! requirements for command handlers, we need to run the ACP connection in a
//! dedicated single-threaded context and communicate via channels.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::thread;

use agent_client_protocol::{
    self as acp, Agent, ClientSideConnection, ContentBlock as AcpContentBlock, EmbeddedResource,
    EmbeddedResourceResource, FileSystemCapability, ImageContent, Implementation,
    InitializeRequest, NewSessionRequest, PromptRequest, RequestPermissionOutcome,
    ResourceLink, ResumeSessionRequest, SelectedPermissionOutcome, SessionNotification, SessionUpdate,
    TerminalExitStatus, TextContent, TextResourceContents,
};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};

use super::types::*;
use crate::ide::db::{ChatDb, DbEntry, DbSession};

/// ACP event names for Tauri
pub mod events {
    pub const ACP_STATUS: &str = "acp:status";
    pub const ACP_SESSION_UPDATE: &str = "acp:session_update";
    pub const ACP_PERMISSION_REQUEST: &str = "acp:permission_request";
    pub const ACP_SESSION_CAPABILITIES: &str = "acp:session_capabilities";
    pub const ACP_ERROR: &str = "acp:error";
    pub const ACP_MESSAGE_END: &str = "acp:message_end";
}

/// Commands that can be sent to the ACP worker thread
#[derive(Debug)]
pub(crate) enum AcpCommand {
    Initialize {
        reply: oneshot::Sender<Result<(), String>>,
    },
    NewSession {
        mode: Option<AgentMode>,
        reply: oneshot::Sender<Result<String, String>>,
    },
    /// Resume a session from database by creating a new ACP session
    ResumeSession {
        db_session_id: String,
        mode: Option<AgentMode>,
        reply: oneshot::Sender<Result<String, String>>,
    },
    SendPrompt {
        session_id: String,
        content: Vec<ContentBlock>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Cancel {
        session_id: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    SetMode {
        session_id: String,
        mode: AgentMode,
        reply: oneshot::Sender<Result<(), String>>,
    },
    RespondPermission {
        request_id: String,
        selected_option: String,
    },
    Shutdown,
}

/// Streaming state for message chunk merging
/// See "Entry Processing Rules" - RULE 1: Message Chunk Handling
struct StreamingState {
    /// Accumulated content from chunks
    accumulated_content: String,
    /// DB entry ID being streamed
    entry_id: i64,
    /// Last content length seen (to handle cumulative chunks from SDK)
    last_length: usize,
}

/// ACP client implementation that bridges to Tauri frontend
struct PanagerAcpClient {
    app_handle: AppHandle,
    /// Pending permission requests awaiting user response
    pending_permissions: Arc<std::sync::Mutex<HashMap<String, oneshot::Sender<String>>>>,
    /// Chat database for storing entries
    chat_db: Arc<ChatDb>,
    /// Streaming state per session (for message chunk merging)
    /// See "Entry Processing Rules" - RULE 1
    streaming_states: Arc<std::sync::Mutex<HashMap<String, StreamingState>>>,
    /// Streaming state per session (for thought chunk merging)
    /// See "Entry Processing Rules" - RULE 9
    thought_streaming_states: Arc<std::sync::Mutex<HashMap<String, StreamingState>>>,
    /// Last event type per session (for message/thought end detection)
    /// See "Entry Processing Rules" - RULE 2
    last_event_types: Arc<std::sync::Mutex<HashMap<String, String>>>,
    /// Current mode per session (for mode change detection)
    /// See "Entry Processing Rules" - RULE 11
    current_modes: Arc<std::sync::Mutex<HashMap<String, String>>>,
    /// Project path for session creation
    project_path: String,
}

impl PanagerAcpClient {
    fn new(app_handle: AppHandle, chat_db: Arc<ChatDb>, project_path: String) -> Self {
        Self {
            app_handle,
            pending_permissions: Arc::new(std::sync::Mutex::new(HashMap::new())),
            chat_db,
            streaming_states: Arc::new(std::sync::Mutex::new(HashMap::new())),
            thought_streaming_states: Arc::new(std::sync::Mutex::new(HashMap::new())),
            last_event_types: Arc::new(std::sync::Mutex::new(HashMap::new())),
            current_modes: Arc::new(std::sync::Mutex::new(HashMap::new())),
            project_path,
        }
    }

    /// Clean tool name from ACP format (e.g., "mcp__acp__Read" -> "Read")
    /// See "Entry Processing Rules" - RULE 3
    fn clean_tool_name(raw: &str) -> String {
        raw.split("__").last().unwrap_or(raw).to_string()
    }

    /// Check if content should be stored in DB based on tool type and size
    fn should_store_content(tool_name: &str, content: &str) -> bool {
        match tool_name {
            "Read" | "WebFetch" => false, // Never store large outputs
            "Bash" | "Grep" | "Glob" => content.len() < 1024, // Only if small
            _ => content.len() < 4096, // Default: store if under 4KB
        }
    }

    /// Resolve a pending permission request with the user's selected option
    fn resolve_permission(&self, request_id: &str, selected_option: String) {
        tracing::info!("ACP: Resolving permission request {} with option: {}", request_id, selected_option);
        let mut pending = self.pending_permissions.lock().unwrap();
        tracing::info!("ACP: Pending permissions: {:?}", pending.keys().collect::<Vec<_>>());
        if let Some(sender) = pending.remove(request_id) {
            tracing::info!("ACP: Found pending request, sending response");
            match sender.send(selected_option) {
                Ok(_) => tracing::info!("ACP: Permission response sent successfully"),
                Err(e) => tracing::error!("ACP: Failed to send permission response: {:?}", e),
            }
        } else {
            tracing::warn!("ACP: No pending request found for id: {}", request_id);
        }
    }

    /// Store a user message in the database
    /// See "Entry Processing Rules" - RULE 8: User Message
    fn store_user_message(&self, session_id: &str, content: &[ContentBlock]) {
        // Extract text content from ContentBlocks
        let text_content: String = content
            .iter()
            .filter_map(|block| {
                if let ContentBlock::Text(text) = block {
                    Some(text.text.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        let entry = DbEntry::new_message(session_id, "user", &text_content);

        if let Err(e) = self.chat_db.add_entry(&entry) {
            tracing::error!("Failed to store user message: {}", e);
        }
    }

    /// Handle streaming message chunk
    /// See "Entry Processing Rules" - RULE 1: Message Chunk Handling
    ///
    /// IF last entry is assistant message AND is_streaming:
    ///     APPEND chunk.content to last entry's content
    /// ELSE:
    ///     CREATE new message entry (role=assistant, content=chunk.content)
    ///     MARK as streaming
    fn handle_message_chunk(&self, session_id: &str, text: &str) {
        let mut streaming = self.streaming_states.lock().unwrap();

        if let Some(state) = streaming.get_mut(session_id) {
            // Handle cumulative chunks - only append new content
            let text_len = text.len();
            if text_len > state.last_length {
                // SDK is sending cumulative content - extract only the new part
                let new_content = &text[state.last_length..];
                state.accumulated_content.push_str(new_content);
                state.last_length = text_len;
            } else if text_len < state.last_length {
                // Shorter than before - treat as delta chunk
                state.accumulated_content.push_str(text);
                state.last_length += text_len;
            }
            // If text_len == state.last_length, it's a duplicate - skip it

            // Update entry with accumulated content
            if let Err(e) = self.chat_db.update_message_content(state.entry_id, &state.accumulated_content) {
                tracing::error!("Failed to update message content: {}", e);
            }
        } else {
            // Start new streaming message - create entry in DB
            let entry = DbEntry::new_message(session_id, "assistant", text);
            match self.chat_db.add_entry(&entry) {
                Ok(entry_id) => {
                    streaming.insert(
                        session_id.to_string(),
                        StreamingState {
                            accumulated_content: text.to_string(),
                            entry_id,
                            last_length: text.len(),
                        },
                    );
                }
                Err(e) => {
                    tracing::error!("Failed to create assistant message: {}", e);
                }
            }
        }
    }

    /// Finalize streaming message (call when message ends)
    /// See "Entry Processing Rules" - RULE 2: Message End Detection
    fn finalize_streaming_message(&self, session_id: &str) {
        let mut streaming = self.streaming_states.lock().unwrap();

        if let Some(state) = streaming.remove(session_id) {
            // Final content update (should already be updated, but ensure consistency)
            if let Err(e) = self.chat_db.update_message_content(state.entry_id, &state.accumulated_content) {
                tracing::error!("Failed to finalize message content: {}", e);
            }

            // Emit message end to frontend
            let _ = self.app_handle.emit(events::ACP_MESSAGE_END, session_id);
        }
    }

    /// Handle streaming thought chunk
    /// See "Entry Processing Rules" - RULE 9: Thought Chunk Handling
    /// Similar to message chunks but creates thought entries
    fn handle_thought_chunk(&self, session_id: &str, text: &str) {
        let mut streaming = self.thought_streaming_states.lock().unwrap();

        if let Some(state) = streaming.get_mut(session_id) {
            // Handle cumulative chunks - only append new content
            let text_len = text.len();
            if text_len > state.last_length {
                // SDK is sending cumulative content - extract only the new part
                let new_content = &text[state.last_length..];
                state.accumulated_content.push_str(new_content);
                state.last_length = text_len;
            } else if text_len < state.last_length {
                // Shorter than before - treat as delta chunk
                state.accumulated_content.push_str(text);
                state.last_length += text_len;
            }
            // If text_len == state.last_length, it's a duplicate - skip it

            // Update entry with accumulated content
            if let Err(e) = self.chat_db.update_message_content(state.entry_id, &state.accumulated_content) {
                tracing::error!("Failed to update thought content: {}", e);
            }
        } else {
            // Start new streaming thought - create entry in DB
            let entry = DbEntry::new_thought(session_id, text);
            match self.chat_db.add_entry(&entry) {
                Ok(entry_id) => {
                    streaming.insert(
                        session_id.to_string(),
                        StreamingState {
                            accumulated_content: text.to_string(),
                            entry_id,
                            last_length: text.len(),
                        },
                    );
                }
                Err(e) => {
                    tracing::error!("Failed to create thought entry: {}", e);
                }
            }
        }
    }

    /// Finalize streaming thought (call when thought ends)
    /// See "Entry Processing Rules" - RULE 9
    fn finalize_streaming_thought(&self, session_id: &str) {
        let mut streaming = self.thought_streaming_states.lock().unwrap();

        if let Some(state) = streaming.remove(session_id) {
            // Final content update (should already be updated, but ensure consistency)
            if let Err(e) = self.chat_db.update_message_content(state.entry_id, &state.accumulated_content) {
                tracing::error!("Failed to finalize thought content: {}", e);
            }
        }
    }
}

#[async_trait::async_trait(?Send)]
impl acp::Client for PanagerAcpClient {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> acp::Result<acp::RequestPermissionResponse, acp::Error> {
        let app = self.app_handle.clone();
        let pending = Arc::clone(&self.pending_permissions);

        // Generate a unique request ID
        let request_id = uuid::Uuid::new_v4().to_string();

        // Create permission request for frontend
        let permission_request = PermissionRequest {
            request_id: request_id.clone(),
            tool_name: args
                .tool_call
                .fields
                .title
                .clone()
                .unwrap_or_else(|| "Tool".to_string()),
            description: format!("Tool: {}", args.tool_call.tool_call_id),
            options: args
                .options
                .iter()
                .map(|opt| PermissionOption {
                    id: opt.option_id.to_string(),
                    label: opt.name.clone(),
                    description: None,
                    is_default: Some(matches!(opt.kind, acp::PermissionOptionKind::AllowOnce)),
                })
                .collect(),
        };

        // Create channel to wait for user response
        let (tx, rx) = oneshot::channel();
        {
            let mut pending_map = pending.lock().unwrap();
            tracing::info!("ACP: Creating permission request with id: {}", request_id);
            pending_map.insert(request_id.clone(), tx);
        }

        // Emit to frontend
        tracing::info!("ACP: Emitting permission request to frontend: {:?}", permission_request);
        let _ = app.emit(events::ACP_PERMISSION_REQUEST, &permission_request);

        // Wait for user response (with timeout)
        match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(selected_option)) => {
                let outcome =
                    RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                        selected_option,
                    ));
                Ok(acp::RequestPermissionResponse::new(outcome))
            }
            _ => {
                // Timeout or cancelled - return cancelled outcome
                Ok(acp::RequestPermissionResponse::new(
                    RequestPermissionOutcome::Cancelled,
                ))
            }
        }
    }

    async fn session_notification(
        &self,
        args: SessionNotification,
    ) -> acp::Result<(), acp::Error> {
        // Forward the session notification to the frontend
        let _ = self.app_handle.emit(events::ACP_SESSION_UPDATE, &args);

        // Process update for database storage
        // See "Entry Processing Rules" for all rules implemented below
        let session_id = args.session_id.to_string();

        // Determine the event type for message/thought end detection (RULE 2, RULE 9)
        let event_type = match &args.update {
            SessionUpdate::AgentMessageChunk(_) => "agent_message_chunk",
            SessionUpdate::AgentThoughtChunk(_) => "agent_thought_chunk",
            SessionUpdate::ToolCall(_) => "tool_call",
            SessionUpdate::ToolCallUpdate(_) => "tool_call_update",
            SessionUpdate::Plan(_) => "plan",
            SessionUpdate::CurrentModeUpdate(_) => "current_mode_update",
            SessionUpdate::AvailableCommandsUpdate(_) => "available_commands_update",
            _ => "other",
        };

        // RULE 2: Message End Detection
        // RULE 9: Thought End Detection
        // If previous event was streaming and current event is different, finalize
        {
            let mut last_types = self.last_event_types.lock().unwrap();
            let prev_type = last_types.get(&session_id).cloned();
            last_types.insert(session_id.clone(), event_type.to_string());

            // Finalize message if transitioning away from message chunks
            if prev_type.as_deref() == Some("agent_message_chunk") && event_type != "agent_message_chunk" {
                tracing::debug!("ACP: Message end detected for session {}, finalizing streaming message", session_id);
                drop(last_types); // Release lock before calling finalize
                self.finalize_streaming_message(&session_id);
            }
            // Finalize thought if transitioning away from thought chunks
            else if prev_type.as_deref() == Some("agent_thought_chunk") && event_type != "agent_thought_chunk" {
                tracing::debug!("ACP: Thought end detected for session {}, finalizing streaming thought", session_id);
                drop(last_types); // Release lock before calling finalize
                self.finalize_streaming_thought(&session_id);
            }
        }

        // Process specific update types
        match &args.update {
            // RULE 1: Message Chunk Handling
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let AcpContentBlock::Text(text_block) = &chunk.content {
                    self.handle_message_chunk(&session_id, &text_block.text);
                }
            }

            // RULE 9: Thought Chunk Handling
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if let AcpContentBlock::Text(text_block) = &chunk.content {
                    self.handle_thought_chunk(&session_id, &text_block.text);
                }
            }

            // RULE 3: Tool Call Creation
            SessionUpdate::ToolCall(tool_call) => {
                // Extract tool name from metadata and clean it
                let raw_tool_name = tool_call.meta.as_ref()
                    .and_then(|m| m.get("claudeCode"))
                    .and_then(|c| c.get("toolName"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("Tool");

                let clean_name = Self::clean_tool_name(raw_tool_name);

                let entry = DbEntry::new_tool_call(
                    &session_id,
                    &tool_call.tool_call_id.to_string(),
                    &clean_name,
                    &format!("{:?}", tool_call.status).to_lowercase(),
                    Some(&format!("{:?}", tool_call.kind).to_lowercase()),
                    Some(&tool_call.title),
                    tool_call.raw_input.as_ref()
                        .and_then(|v| serde_json::to_string(v).ok())
                        .as_deref(),
                );

                if let Err(e) = self.chat_db.add_entry(&entry) {
                    tracing::error!("Failed to store tool call: {}", e);
                }
            }

            // RULE 4: Tool Call Update
            SessionUpdate::ToolCallUpdate(update) => {
                let tool_call_id = update.tool_call_id.to_string();

                // Get tool name to determine if we should store content
                let raw_tool_name = update.meta.as_ref()
                    .and_then(|m| m.get("claudeCode"))
                    .and_then(|c| c.get("toolName"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("Tool");
                let clean_name = Self::clean_tool_name(raw_tool_name);

                let status = update.fields.status.as_ref()
                    .map(|s| format!("{:?}", s).to_lowercase())
                    .unwrap_or_else(|| "completed".to_string());

                // Extract and conditionally store content
                let content_to_store = update.fields.content.as_ref().and_then(|content_blocks| {
                    use agent_client_protocol::ToolCallContent;
                    let text_content: String = content_blocks.iter()
                        .filter_map(|block| {
                            match block {
                                ToolCallContent::Content(content) => {
                                    if let AcpContentBlock::Text(text) = &content.content {
                                        Some(text.text.clone())
                                    } else {
                                        None
                                    }
                                }
                                _ => None,
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n");

                    if Self::should_store_content(&clean_name, &text_content) {
                        Some(text_content)
                    } else {
                        None
                    }
                });

                if let Err(e) = self.chat_db.update_tool_call(&tool_call_id, &status, content_to_store.as_deref()) {
                    tracing::error!("Failed to update tool call: {}", e);
                }
            }

            // RULE 10: Plan Update
            SessionUpdate::Plan(plan) => {
                // Serialize plan entries to JSON
                let entries_json = serde_json::to_string(&plan.entries).unwrap_or_else(|_| "[]".to_string());

                let entry = DbEntry::new_plan(&session_id, &entries_json);
                if let Err(e) = self.chat_db.add_entry(&entry) {
                    tracing::error!("Failed to store plan entry: {}", e);
                }
            }

            // RULE 11: Current Mode Update
            SessionUpdate::CurrentModeUpdate(mode_update) => {
                // Get the previous mode from state or default to "agent"
                let previous_mode = {
                    let modes = self.current_modes.lock().unwrap();
                    modes.get(&session_id).cloned().unwrap_or_else(|| "agent".to_string())
                };

                let new_mode = mode_update.current_mode_id.to_string();

                // Only create entry if mode actually changed
                if previous_mode != new_mode {
                    let entry = DbEntry::new_mode_change(&session_id, &previous_mode, &new_mode);
                    if let Err(e) = self.chat_db.add_entry(&entry) {
                        tracing::error!("Failed to store mode change entry: {}", e);
                    }

                    // Update the stored current mode
                    let mut modes = self.current_modes.lock().unwrap();
                    modes.insert(session_id.clone(), new_mode);
                }
            }

            // RULE 12: Available Commands Update (stored in state, not as entry)
            SessionUpdate::AvailableCommandsUpdate(commands_update) => {
                // Store commands in memory for later use
                // The frontend will receive this via the forwarded event
                tracing::debug!("ACP: Available commands update: {:?}", commands_update.available_commands.len());
            }

            _ => {}
        }

        Ok(())
    }

    // File system operations
    async fn read_text_file(
        &self,
        args: acp::ReadTextFileRequest,
    ) -> acp::Result<acp::ReadTextFileResponse, acp::Error> {
        let content = tokio::fs::read_to_string(&args.path).await.map_err(|e| {
            acp::Error::internal_error()
                .data(serde_json::json!({"error": format!("Failed to read file: {}", e)}))
        })?;

        // Handle line and limit if provided
        let content = if args.line.is_some() || args.limit.is_some() {
            let lines: Vec<&str> = content.lines().collect();
            let start = args.line.unwrap_or(0) as usize;
            let limit = args.limit.map(|l| l as usize).unwrap_or(lines.len());

            let end = (start + limit).min(lines.len());
            lines[start..end].join("\n")
        } else {
            content
        };

        let response = acp::ReadTextFileResponse::new(content);
        Ok(response)
    }

    async fn write_text_file(
        &self,
        args: acp::WriteTextFileRequest,
    ) -> acp::Result<acp::WriteTextFileResponse, acp::Error> {
        // Create parent directories if needed
        if let Some(parent) = args.path.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                acp::Error::internal_error()
                    .data(serde_json::json!({"error": format!("Failed to create dirs: {}", e)}))
            })?;
        }

        tokio::fs::write(&args.path, &args.content)
            .await
            .map_err(|e| {
                acp::Error::internal_error()
                    .data(serde_json::json!({"error": format!("Failed to write file: {}", e)}))
            })?;

        Ok(acp::WriteTextFileResponse::new())
    }

    // Terminal operations
    async fn create_terminal(
        &self,
        args: acp::CreateTerminalRequest,
    ) -> acp::Result<acp::CreateTerminalResponse, acp::Error> {
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c").arg(&args.command);

        if let Some(ref cwd) = args.cwd {
            cmd.current_dir(cwd);
        }

        let _output = cmd.output().await.map_err(|e| {
            acp::Error::internal_error()
                .data(serde_json::json!({"error": format!("Failed to execute: {}", e)}))
        })?;

        let terminal_id = uuid::Uuid::new_v4().to_string();
        Ok(acp::CreateTerminalResponse::new(terminal_id))
    }

    async fn terminal_output(
        &self,
        _args: acp::TerminalOutputRequest,
    ) -> acp::Result<acp::TerminalOutputResponse, acp::Error> {
        // Since we execute commands immediately, no streaming output
        Ok(acp::TerminalOutputResponse::new(String::new(), false))
    }

    async fn release_terminal(
        &self,
        _args: acp::ReleaseTerminalRequest,
    ) -> acp::Result<acp::ReleaseTerminalResponse, acp::Error> {
        Ok(acp::ReleaseTerminalResponse::new())
    }

    async fn wait_for_terminal_exit(
        &self,
        _args: acp::WaitForTerminalExitRequest,
    ) -> acp::Result<acp::WaitForTerminalExitResponse, acp::Error> {
        let exit_status = TerminalExitStatus::new().exit_code(0);
        Ok(acp::WaitForTerminalExitResponse::new(exit_status))
    }

    async fn kill_terminal_command(
        &self,
        _args: acp::KillTerminalCommandRequest,
    ) -> acp::Result<acp::KillTerminalCommandResponse, acp::Error> {
        Ok(acp::KillTerminalCommandResponse::new())
    }
}

/// ACP Process Manager
///
/// Runs the ACP connection in a dedicated thread with a single-threaded
/// Tokio runtime to work around the SDK's !Send futures.
pub struct AcpProcess {
    /// Command sender to the worker thread
    command_tx: Option<mpsc::Sender<AcpCommand>>,
    /// Worker thread handle
    worker_handle: Option<thread::JoinHandle<()>>,
    /// Current session ID (ACP session ID, same as DB primary key)
    current_session_id: Option<String>,
    /// Connection status
    status: SessionStatus,
    /// Project path
    project_path: String,
    /// Chat database
    chat_db: Arc<ChatDb>,
}

impl AcpProcess {
    /// Create a new ACP process manager
    pub fn new(project_path: String) -> Result<Self, String> {
        let path = Path::new(&project_path);
        let chat_db = ChatDb::open(path)
            .map_err(|e| format!("Failed to open chat database: {}", e))?;

        Ok(Self {
            command_tx: None,
            worker_handle: None,
            current_session_id: None,
            status: SessionStatus::Disconnected,
            project_path,
            chat_db: Arc::new(chat_db),
        })
    }

    /// Get the chat database
    pub fn chat_db(&self) -> &Arc<ChatDb> {
        &self.chat_db
    }

    /// Spawn the claude-code-acp process
    /// Returns the command channel sender for registration with AcpState
    pub(crate) async fn spawn(&mut self, app_handle: AppHandle) -> Result<mpsc::Sender<AcpCommand>, String> {
        if self.command_tx.is_some() {
            tracing::warn!("ACP: Process already running");
            return Err("Process already running".to_string());
        }

        tracing::info!("ACP: Starting spawn process");
        self.status = SessionStatus::Connecting;
        self.emit_status(&app_handle);

        let (command_tx, command_rx) = mpsc::channel::<AcpCommand>(32);
        let project_path = self.project_path.clone();
        let app_handle_clone = app_handle.clone();
        let chat_db = Arc::clone(&self.chat_db);

        // Spawn the worker thread with its own single-threaded runtime
        tracing::info!("ACP: Spawning worker thread");
        let worker_handle = thread::spawn(move || {
            // Create a new single-threaded runtime
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Failed to create runtime");

            // Create a LocalSet for running !Send futures
            let local = tokio::task::LocalSet::new();

            local.block_on(&rt, async move {
                run_acp_worker(command_rx, project_path, app_handle_clone, chat_db).await;
            });
        });

        let command_tx_clone = command_tx.clone();
        self.command_tx = Some(command_tx);
        self.worker_handle = Some(worker_handle);

        // Initialize the connection
        tracing::info!("ACP: Sending initialize command to worker");
        let (reply_tx, reply_rx) = oneshot::channel();
        self.command_tx
            .as_ref()
            .unwrap()
            .send(AcpCommand::Initialize { reply: reply_tx })
            .await
            .map_err(|_| {
                tracing::error!("ACP: Failed to send initialize command");
                "Failed to send initialize command"
            })?;

        tracing::info!("ACP: Waiting for initialize response");
        reply_rx
            .await
            .map_err(|_| {
                tracing::error!("ACP: Failed to receive initialize response");
                "Failed to receive initialize response"
            })??;

        tracing::info!("ACP: Connection ready");
        self.status = SessionStatus::Ready;
        self.emit_status(&app_handle);

        Ok(command_tx_clone)
    }

    /// Emit status update to frontend
    fn emit_status(&self, app_handle: &AppHandle) {
        tracing::debug!("ACP: Emitting status {:?}", self.status);
        let _ = app_handle.emit(events::ACP_STATUS, self.status);
    }

    /// Create a new session
    pub async fn new_session(
        &mut self,
        mode: Option<AgentMode>,
        app_handle: &AppHandle,
    ) -> Result<String, String> {
        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        let (reply_tx, reply_rx) = oneshot::channel();
        command_tx
            .send(AcpCommand::NewSession {
                mode,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Failed to send new_session command")?;

        let session_id = reply_rx
            .await
            .map_err(|_| "Failed to receive new_session response")??;

        // Session ID from ACP is used directly as DB primary key
        self.current_session_id = Some(session_id.clone());
        self.emit_status(app_handle);

        Ok(session_id)
    }

    /// Resume a session from the database using persistent session ID
    /// Uses load_session to restore the session state from ACP agent
    pub async fn resume_session(
        &mut self,
        session_id: &str,
        mode: Option<AgentMode>,
        app_handle: &AppHandle,
    ) -> Result<String, String> {
        // If this is already the current session, nothing to do
        if self.current_session_id.as_deref() == Some(session_id) {
            tracing::info!("ACP: Session {} is already current", session_id);
            return Ok(session_id.to_string());
        }

        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        let (reply_tx, reply_rx) = oneshot::channel();
        command_tx
            .send(AcpCommand::ResumeSession {
                db_session_id: session_id.to_string(),
                mode,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Failed to send resume_session command")?;

        let loaded_session_id = reply_rx
            .await
            .map_err(|_| "Failed to receive resume_session response")??;

        tracing::info!("ACP: Resumed session {}", loaded_session_id);
        self.current_session_id = Some(session_id.to_string());
        self.emit_status(app_handle);

        Ok(session_id.to_string())
    }

    /// Send a prompt to the current session
    pub async fn send_prompt(
        &mut self,
        session_id: &str,
        content: Vec<ContentBlock>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        self.status = SessionStatus::Prompting;
        self.emit_status(app_handle);

        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        let (reply_tx, reply_rx) = oneshot::channel();
        command_tx
            .send(AcpCommand::SendPrompt {
                session_id: session_id.to_string(),
                content,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Failed to send prompt command")?;

        let result = reply_rx
            .await
            .map_err(|_| "Failed to receive prompt response")?;

        self.status = SessionStatus::Ready;
        self.emit_status(app_handle);

        result
    }

    /// Cancel the current prompt
    pub async fn cancel(&mut self, session_id: &str) -> Result<(), String> {
        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        let (reply_tx, reply_rx) = oneshot::channel();
        command_tx
            .send(AcpCommand::Cancel {
                session_id: session_id.to_string(),
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Failed to send cancel command")?;

        reply_rx
            .await
            .map_err(|_| "Failed to receive cancel response")?
    }

    /// Set the session mode
    pub async fn set_mode(
        &mut self,
        session_id: &str,
        mode: AgentMode,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        let (reply_tx, reply_rx) = oneshot::channel();
        command_tx
            .send(AcpCommand::SetMode {
                session_id: session_id.to_string(),
                mode,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Failed to send set_mode command")?;

        let result = reply_rx
            .await
            .map_err(|_| "Failed to receive set_mode response")?;

        self.emit_status(app_handle);

        result
    }

    /// Respond to a permission request
    pub async fn respond_permission(
        &self,
        request_id: &str,
        selected_option: String,
    ) -> Result<(), String> {
        tracing::info!("ACP Process: respond_permission called for request_id={}, option={}", request_id, selected_option);

        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or_else(|| {
                tracing::error!("ACP Process: respond_permission failed - connection not established");
                "Connection not established".to_string()
            })?;

        tracing::info!("ACP Process: Sending RespondPermission command to worker");
        command_tx
            .send(AcpCommand::RespondPermission {
                request_id: request_id.to_string(),
                selected_option,
            })
            .await
            .map_err(|e| {
                tracing::error!("ACP Process: Failed to send RespondPermission command: {:?}", e);
                "Failed to send respond_permission command".to_string()
            })?;

        tracing::info!("ACP Process: RespondPermission command sent successfully");
        Ok(())
    }

    /// Get current status
    pub fn status(&self) -> SessionStatus {
        self.status
    }

    /// Get current session ID
    pub fn current_session_id(&self) -> Option<&str> {
        self.current_session_id.as_deref()
    }

    /// Disconnect and cleanup
    pub async fn disconnect(&mut self) {
        if let Some(tx) = self.command_tx.take() {
            let _ = tx.send(AcpCommand::Shutdown).await;
        }

        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }

        self.current_session_id = None;
        self.status = SessionStatus::Disconnected;
    }

    /// Check if process is running
    pub fn is_running(&self) -> bool {
        self.command_tx.is_some()
    }

    // =========================================================================
    // Database Operations
    // =========================================================================

    /// List all chat sessions for this project
    pub fn list_sessions(&self) -> Result<Vec<crate::ide::db::DbSessionInfo>, String> {
        self.chat_db
            .list_sessions()
            .map_err(|e| format!("Failed to list sessions: {}", e))
    }

    /// Load a chat session with all its entries
    pub fn load_session(
        &self,
        session_id: &str,
    ) -> Result<Option<crate::ide::db::DbSessionWithEntries>, String> {
        self.chat_db
            .load_session(session_id)
            .map_err(|e| format!("Failed to load session: {}", e))
    }

    /// Delete a chat session
    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        self.chat_db
            .delete_session(session_id)
            .map_err(|e| format!("Failed to delete session: {}", e))
    }

    /// Update session name
    pub fn update_session_name(&self, session_id: &str, name: &str) -> Result<(), String> {
        self.chat_db
            .update_session_name(session_id, name)
            .map_err(|e| format!("Failed to update session name: {}", e))
    }
}

/// Worker function that runs in a dedicated thread with LocalSet
async fn run_acp_worker(
    mut command_rx: mpsc::Receiver<AcpCommand>,
    project_path: String,
    app_handle: AppHandle,
    chat_db: Arc<ChatDb>,
) {
    // Spawn the claude-code-acp process
    tracing::info!("ACP: Spawning claude-code-acp in {}", project_path);
    let mut child = match Command::new("npx")
        .args(["@zed-industries/claude-code-acp@latest"])
        .current_dir(&project_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => {
            tracing::info!("ACP: Process spawned successfully");
            c
        }
        Err(e) => {
            tracing::error!("ACP: Failed to spawn process: {}", e);
            let _ = app_handle.emit(events::ACP_ERROR, format!("Failed to spawn: {}", e));
            return;
        }
    };

    let stdin = match child.stdin.take() {
        Some(s) => s,
        None => {
            let _ = app_handle.emit(events::ACP_ERROR, "Failed to get stdin handle");
            return;
        }
    };
    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let _ = app_handle.emit(events::ACP_ERROR, "Failed to get stdout handle");
            return;
        }
    };
    let stderr = child.stderr.take();

    // Spawn stderr reader to log any errors from the child process
    if let Some(stderr) = stderr {
        let mut stderr_reader = BufReader::new(stderr);
        tokio::task::spawn_local(async move {
            let mut line = String::new();
            loop {
                line.clear();
                match stderr_reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        tracing::warn!("ACP stderr: {}", line.trim());
                    }
                    Err(e) => {
                        tracing::error!("ACP stderr read error: {}", e);
                        break;
                    }
                }
            }
        });
    }

    // Create the ACP client
    let client = Arc::new(PanagerAcpClient::new(app_handle.clone(), chat_db.clone(), project_path.clone()));
    let client_clone = Arc::clone(&client);

    // Create pipe adapters for the SDK
    let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<Vec<u8>>(100);
    let (incoming_tx, incoming_rx) = mpsc::channel::<Vec<u8>>(100);

    // Spawn writer task (within LocalSet)
    let mut stdin_writer = stdin;
    tokio::task::spawn_local(async move {
        tracing::info!("ACP: stdin writer started");
        while let Some(data) = outgoing_rx.recv().await {
            let data_str = String::from_utf8_lossy(&data);
            tracing::debug!("ACP: stdin writing {} bytes: {}", data.len(), data_str.trim());
            if let Err(e) = stdin_writer.write_all(&data).await {
                tracing::error!("ACP: stdin write error: {}", e);
                break;
            }
            if let Err(e) = stdin_writer.flush().await {
                tracing::error!("ACP: stdin flush error: {}", e);
                break;
            }
        }
        tracing::info!("ACP: stdin writer exiting");
    });

    // Spawn reader task (within LocalSet)
    let mut stdout_reader = BufReader::new(stdout);
    let incoming_tx_clone = incoming_tx.clone();
    tokio::task::spawn_local(async move {
        tracing::info!("ACP: stdout reader started");
        let mut line = String::new();
        loop {
            line.clear();
            match stdout_reader.read_line(&mut line).await {
                Ok(0) => {
                    tracing::info!("ACP: stdout EOF");
                    break;
                }
                Ok(n) => {
                    tracing::debug!("ACP: stdout received {} bytes: {}", n, line.trim());
                    if incoming_tx_clone
                        .send(line.as_bytes().to_vec())
                        .await
                        .is_err()
                    {
                        tracing::error!("ACP: Failed to send stdout to channel");
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("ACP: stdout read error: {}", e);
                    break;
                }
            }
        }
        tracing::info!("ACP: stdout reader exiting");
    });

    // Create async read/write adapters
    let outgoing = AsyncWriteAdapter { sender: outgoing_tx };
    let incoming = AsyncReadAdapter {
        receiver: tokio::sync::Mutex::new(incoming_rx),
        buffer: tokio::sync::Mutex::new(Vec::new()),
    };

    // Create the connection using the SDK
    let (connection, io_future) = ClientSideConnection::new(client_clone, outgoing, incoming, |fut| {
        tokio::task::spawn_local(fut);
    });

    // Spawn the I/O handler (within LocalSet)
    tokio::task::spawn_local(async move {
        let _ = io_future.await;
    });

    let connection = Arc::new(tokio::sync::Mutex::new(connection));

    // Process commands
    while let Some(cmd) = command_rx.recv().await {
        match cmd {
            AcpCommand::Initialize { reply } => {
                let result = initialize_connection(&connection, &app_handle).await;
                let _ = reply.send(result);
            }
            AcpCommand::NewSession { mode, reply } => {
                let result = create_new_session(&connection, &project_path, &chat_db, mode, &app_handle).await;
                let _ = reply.send(result);
            }
            AcpCommand::ResumeSession { db_session_id, mode, reply } => {
                // Resume a session: try to load it from ACP agent using persistent session ID
                let result = resume_acp_session(&connection, &project_path, &db_session_id, mode).await;
                tracing::info!("ACP: Resume session {} result: {:?}", db_session_id, result);
                let _ = reply.send(result);
            }
            AcpCommand::SendPrompt {
                session_id,
                content,
                reply,
            } => {
                // RULE 8: Store user message in database before sending
                client.store_user_message(&session_id, &content);

                // Spawn prompt processing as a separate task so the worker loop
                // can continue receiving commands (especially RespondPermission)
                let connection_clone = Arc::clone(&connection);
                let client_clone = Arc::clone(&client);
                let session_id_clone = session_id.clone();
                tokio::task::spawn_local(async move {
                    // Send prompt and wait for completion
                    let result = send_prompt_to_session(&connection_clone, &session_id_clone, content).await;

                    // Finalize any streaming assistant message after prompt completes
                    client_clone.finalize_streaming_message(&session_id_clone);

                    let _ = reply.send(result);
                });
            }
            AcpCommand::Cancel { session_id, reply } => {
                let result = cancel_session(&connection, &session_id).await;
                let _ = reply.send(result);
            }
            AcpCommand::SetMode {
                session_id,
                mode,
                reply,
            } => {
                let result = set_session_mode(&connection, &session_id, mode).await;
                let _ = reply.send(result);
            }
            AcpCommand::RespondPermission {
                request_id,
                selected_option,
            } => {
                tracing::info!("ACP Worker: Received RespondPermission command for request_id={}, option={}", request_id, selected_option);
                client.resolve_permission(&request_id, selected_option);
                tracing::info!("ACP Worker: resolve_permission completed");
            }
            AcpCommand::Shutdown => {
                break;
            }
        }
    }

    // Cleanup
    let _ = child.kill().await;
}

async fn initialize_connection(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    _app_handle: &AppHandle,
) -> Result<(), String> {
    tracing::info!("ACP: Starting initialization...");
    let client_info =
        Implementation::new("Panager".to_string(), env!("CARGO_PKG_VERSION").to_string());

    let fs_caps = FileSystemCapability::new()
        .read_text_file(true)
        .write_text_file(true);

    let capabilities = acp::ClientCapabilities::new().fs(fs_caps).terminal(true);

    let request = InitializeRequest::new(acp::ProtocolVersion::LATEST)
        .client_capabilities(capabilities)
        .client_info(client_info);

    tracing::info!("ACP: Sending initialize request...");
    let conn = connection.lock().await;
    let result = conn
        .initialize(request)
        .await
        .map_err(|e| {
            tracing::error!("ACP: Initialize failed: {}", e);
            format!("Failed to initialize ACP: {}", e)
        })?;

    if let Some(agent_info) = &result.agent_info {
        tracing::info!(
            "ACP initialized with agent: {} v{}",
            agent_info.name,
            agent_info.version
        );
    } else {
        tracing::info!("ACP initialized (agent info not provided)");
    }

    Ok(())
}

async fn create_new_session(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    project_path: &str,
    chat_db: &ChatDb,
    _mode: Option<AgentMode>,
    app_handle: &AppHandle,
) -> Result<String, String> {
    let cwd = PathBuf::from(project_path);
    let request = NewSessionRequest::new(cwd);

    let conn = connection.lock().await;
    let result = conn
        .new_session(request)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))?;

    // Use ACP session ID directly as our DB primary key
    let session_id = result.session_id.to_string();
    let now = chrono::Utc::now().timestamp_millis();

    // Create session in database
    let db_session = DbSession {
        id: session_id.clone(),
        name: "New Chat".to_string(),
        project_path: project_path.to_string(),
        created_at: now,
        updated_at: now,
    };

    if let Err(e) = chat_db.create_session(&db_session) {
        tracing::error!("Failed to create session in database: {}", e);
    }

    // RULE 7: Extract and store session capabilities as meta entry
    if let Some(modes) = &result.modes {
        let available_modes_json = serde_json::to_string(&modes.available_modes.iter().map(|m| {
            super::types::AcpSessionMode {
                id: m.id.to_string(),
                name: m.name.clone(),
                description: m.description.clone(),
            }
        }).collect::<Vec<_>>()).unwrap_or_else(|_| "[]".to_string());

        let available_models_json = result.models.as_ref().map(|models| {
            serde_json::to_string(&models.available_models.iter().map(|m| {
                super::types::AcpSessionModel {
                    model_id: m.model_id.to_string(),
                    name: m.name.clone(),
                    description: m.description.clone(),
                }
            }).collect::<Vec<_>>()).unwrap_or_else(|_| "[]".to_string())
        });

        let meta_entry = DbEntry::new_meta(
            &session_id,
            &available_modes_json,
            available_models_json.as_deref(),
            None, // available_commands - not available from new_session response
            &modes.current_mode_id.to_string(),
            result.models.as_ref().map(|m| m.current_model_id.to_string()).as_deref(),
        );

        if let Err(e) = chat_db.add_entry(&meta_entry) {
            tracing::error!("Failed to store meta entry: {}", e);
        }

        // Also emit to frontend for real-time update
        let capabilities = super::types::SessionCapabilities {
            available_modes: modes.available_modes.iter().map(|m| {
                super::types::AcpSessionMode {
                    id: m.id.to_string(),
                    name: m.name.clone(),
                    description: m.description.clone(),
                }
            }).collect(),
            current_mode_id: modes.current_mode_id.to_string(),
            available_models: result.models.as_ref().map(|models| {
                models.available_models.iter().map(|m| {
                    super::types::AcpSessionModel {
                        model_id: m.model_id.to_string(),
                        name: m.name.clone(),
                        description: m.description.clone(),
                    }
                }).collect()
            }),
            current_model_id: result.models.as_ref().map(|m| m.current_model_id.to_string()),
        };
        let _ = app_handle.emit(events::ACP_SESSION_CAPABILITIES, &capabilities);
        tracing::info!("ACP: Emitted session capabilities with {} modes", capabilities.available_modes.len());
    }

    Ok(session_id)
}

/// Resume a session by loading it from the ACP agent
/// The session ID is persistent (ACP ID), so we try multiple strategies:
/// 1. load_session (full state restoration)
/// 2. resume_session (partial state, no message history)
/// 3. new_session as last resort
async fn resume_acp_session(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    project_path: &str,
    session_id: &str,
    _mode: Option<AgentMode>,
) -> Result<String, String> {
    let cwd = PathBuf::from(project_path);
    let conn = connection.lock().await;

    // Step 1: Try load_session first (restores full session state)
    let load_request = acp::LoadSessionRequest::new(session_id.to_string(), cwd.clone());
    if conn.load_session(load_request).await.is_ok() {
        tracing::info!("ACP: Successfully loaded session {}", session_id);
        return Ok(session_id.to_string());
    }

    // Step 2: Try resume_session (may work if agent has partial state)
    tracing::info!("ACP: load_session failed, trying resume_session for {}", session_id);
    let resume_request = ResumeSessionRequest::new(session_id.to_string(), cwd.clone());
    if conn.resume_session(resume_request).await.is_ok() {
        tracing::info!("ACP: Successfully resumed session {}", session_id);
        return Ok(session_id.to_string());
    }

    // Step 3: Fall back to new session only as last resort
    tracing::warn!("ACP: Both load and resume failed for {}. Creating new session.", session_id);
    let new_request = NewSessionRequest::new(cwd);
    let result = conn
        .new_session(new_request)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))?;

    // Note: This creates a new ACP session but the caller keeps using the same DB session ID
    // The conversation history is preserved in our DB, just not in ACP agent
    let new_session_id = result.session_id.to_string();
    tracing::info!("ACP: Created new ACP session {} as fallback for {}", new_session_id, session_id);
    Ok(new_session_id)
}

async fn send_prompt_to_session(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    session_id: &str,
    content: Vec<ContentBlock>,
) -> Result<(), String> {
    // Convert our ContentBlock to SDK's ContentBlock
    let acp_content: Vec<AcpContentBlock> = content
        .into_iter()
        .map(|block| match block {
            ContentBlock::Text(text) => AcpContentBlock::Text(TextContent::new(text.text)),
            ContentBlock::Image(img) => {
                AcpContentBlock::Image(ImageContent::new(img.source.data, img.source.media_type))
            }
            ContentBlock::Resource(res) => {
                let text_contents = TextResourceContents::new(
                    res.resource.text.unwrap_or_default(),
                    res.resource.uri.clone(),
                );
                let resource_resource = EmbeddedResourceResource::TextResourceContents(text_contents);
                let resource = EmbeddedResource::new(resource_resource);
                AcpContentBlock::Resource(resource)
            }
            ContentBlock::ResourceLink {
                uri,
                name,
                mime_type,
            } => {
                let display_name = name.unwrap_or_else(|| uri.clone());
                let mut link = ResourceLink::new(display_name, uri);
                if let Some(mt) = mime_type {
                    link = link.mime_type(mt);
                }
                AcpContentBlock::ResourceLink(link)
            }
        })
        .collect();

    let request = PromptRequest::new(session_id.to_string(), acp_content);

    let conn = connection.lock().await;
    conn.prompt(request)
        .await
        .map_err(|e| format!("Failed to send prompt: {}", e))?;

    Ok(())
}

async fn cancel_session(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    session_id: &str,
) -> Result<(), String> {
    let notification = acp::CancelNotification::new(session_id.to_string());

    let conn = connection.lock().await;
    conn.cancel(notification)
        .await
        .map_err(|e| format!("Failed to cancel: {}", e))?;

    Ok(())
}

async fn set_session_mode(
    connection: &Arc<tokio::sync::Mutex<ClientSideConnection>>,
    session_id: &str,
    mode: AgentMode,
) -> Result<(), String> {
    let mode_id = super::protocol::to_sdk_mode_id(mode);
    let request = acp::SetSessionModeRequest::new(session_id.to_string(), mode_id);

    let conn = connection.lock().await;
    conn.set_session_mode(request)
        .await
        .map_err(|e| format!("Failed to set mode: {}", e))?;

    Ok(())
}

// Async adapters for the SDK
struct AsyncWriteAdapter {
    sender: mpsc::Sender<Vec<u8>>,
}

impl futures::io::AsyncWrite for AsyncWriteAdapter {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match self.sender.try_send(buf.to_vec()) {
            Ok(_) => std::task::Poll::Ready(Ok(buf.len())),
            Err(mpsc::error::TrySendError::Full(_)) => std::task::Poll::Pending,
            Err(_) => std::task::Poll::Ready(Err(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                "channel closed",
            ))),
        }
    }

    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::task::Poll::Ready(Ok(()))
    }

    fn poll_close(
        self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::task::Poll::Ready(Ok(()))
    }
}

struct AsyncReadAdapter {
    receiver: tokio::sync::Mutex<mpsc::Receiver<Vec<u8>>>,
    buffer: tokio::sync::Mutex<Vec<u8>>,
}

impl futures::io::AsyncRead for AsyncReadAdapter {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut [u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        let mut buffer = match self.buffer.try_lock() {
            Ok(b) => b,
            Err(_) => return std::task::Poll::Pending,
        };

        if !buffer.is_empty() {
            let len = std::cmp::min(buf.len(), buffer.len());
            buf[..len].copy_from_slice(&buffer[..len]);
            buffer.drain(..len);
            return std::task::Poll::Ready(Ok(len));
        }

        let mut receiver = match self.receiver.try_lock() {
            Ok(r) => r,
            Err(_) => return std::task::Poll::Pending,
        };

        match std::pin::Pin::new(&mut *receiver).poll_recv(cx) {
            std::task::Poll::Ready(Some(data)) => {
                let len = std::cmp::min(buf.len(), data.len());
                buf[..len].copy_from_slice(&data[..len]);
                if data.len() > len {
                    buffer.extend_from_slice(&data[len..]);
                }
                std::task::Poll::Ready(Ok(len))
            }
            std::task::Poll::Ready(None) => std::task::Poll::Ready(Ok(0)),
            std::task::Poll::Pending => std::task::Poll::Pending,
        }
    }
}

/// Global ACP process state (per-project)
pub struct AcpState {
    /// Map of project path to ACP process
    processes: RwLock<HashMap<String, Arc<Mutex<AcpProcess>>>>,
    /// Separate map for command channels (allows sending without locking the process)
    /// This is needed to avoid deadlock when responding to permissions while a prompt is in progress
    command_channels: RwLock<HashMap<String, mpsc::Sender<AcpCommand>>>,
}

impl AcpState {
    pub fn new() -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            command_channels: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create an ACP process for a project
    pub async fn get_or_create(&self, project_path: &str) -> Result<Arc<Mutex<AcpProcess>>, String> {
        let mut processes = self.processes.write().await;

        if let Some(process) = processes.get(project_path) {
            return Ok(Arc::clone(process));
        }

        let process = AcpProcess::new(project_path.to_string())?;
        let process = Arc::new(Mutex::new(process));
        processes.insert(project_path.to_string(), Arc::clone(&process));
        Ok(process)
    }

    /// Register a command channel for a project (called after spawn)
    pub(crate) async fn register_command_channel(&self, project_path: &str, tx: mpsc::Sender<AcpCommand>) {
        let mut channels = self.command_channels.write().await;
        channels.insert(project_path.to_string(), tx);
    }

    /// Get command channel for a project (for permission responses)
    async fn get_command_channel(&self, project_path: &str) -> Option<mpsc::Sender<AcpCommand>> {
        let channels = self.command_channels.read().await;
        channels.get(project_path).cloned()
    }

    /// Remove an ACP process
    pub async fn remove(&self, project_path: &str) {
        // Remove command channel
        {
            let mut channels = self.command_channels.write().await;
            channels.remove(project_path);
        }
        // Remove and disconnect process
        let mut processes = self.processes.write().await;
        if let Some(process) = processes.remove(project_path) {
            let mut p = process.lock().await;
            p.disconnect().await;
        }
    }

    /// Disconnect all processes
    pub async fn disconnect_all(&self) {
        // Clear command channels
        {
            let mut channels = self.command_channels.write().await;
            channels.clear();
        }
        // Disconnect all processes
        let mut processes = self.processes.write().await;
        for (_, process) in processes.drain() {
            let mut p = process.lock().await;
            p.disconnect().await;
        }
    }

    /// Send a permission response directly without locking the process
    /// This avoids deadlock when a prompt is waiting for permission
    pub async fn respond_permission(
        &self,
        project_path: &str,
        request_id: &str,
        selected_option: String,
    ) -> Result<(), String> {
        tracing::info!("ACP State: respond_permission for project={}, request_id={}", project_path, request_id);

        let channel = self.get_command_channel(project_path).await
            .ok_or_else(|| {
                tracing::error!("ACP State: No command channel found for project");
                "ACP not connected".to_string()
            })?;

        tracing::info!("ACP State: Sending RespondPermission command to worker");
        channel
            .send(AcpCommand::RespondPermission {
                request_id: request_id.to_string(),
                selected_option,
            })
            .await
            .map_err(|e| {
                tracing::error!("ACP State: Failed to send permission response: {:?}", e);
                "Failed to send permission response".to_string()
            })?;

        tracing::info!("ACP State: Permission response sent successfully");
        Ok(())
    }
}

impl Default for AcpState {
    fn default() -> Self {
        Self::new()
    }
}
