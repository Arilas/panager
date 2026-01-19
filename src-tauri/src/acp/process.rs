//! ACP Process Management using the official agent-client-protocol SDK
//!
//! Handles spawning and managing the claude-code-acp child process.
//!
//! The agent-client-protocol SDK uses `#[async_trait(?Send)]` which means its futures
//! are not Send-safe. Since Tauri uses a multi-threaded Tokio runtime with Send
//! requirements for command handlers, we need to run the ACP connection in a
//! dedicated single-threaded context and communicate via channels.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::thread;

use agent_client_protocol::{
    self as acp, Agent, ClientSideConnection, ContentBlock as AcpContentBlock, EmbeddedResource,
    EmbeddedResourceResource, FileSystemCapability, ImageContent, Implementation,
    InitializeRequest, NewSessionRequest, PromptRequest, RequestPermissionOutcome,
    ResourceLink, SelectedPermissionOutcome, SessionNotification, TerminalExitStatus,
    TextContent, TextResourceContents,
};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};

use super::types::*;

/// ACP event names for Tauri
pub mod events {
    pub const ACP_STATUS: &str = "acp:status";
    pub const ACP_SESSION_UPDATE: &str = "acp:session_update";
    pub const ACP_PERMISSION_REQUEST: &str = "acp:permission_request";
    pub const ACP_ERROR: &str = "acp:error";
}

/// Commands that can be sent to the ACP worker thread
#[derive(Debug)]
enum AcpCommand {
    Initialize {
        reply: oneshot::Sender<Result<(), String>>,
    },
    NewSession {
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

/// ACP client implementation that bridges to Tauri frontend
struct PanagerAcpClient {
    app_handle: AppHandle,
    /// Pending permission requests awaiting user response
    pending_permissions: Arc<std::sync::Mutex<HashMap<String, oneshot::Sender<String>>>>,
}

impl PanagerAcpClient {
    fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            pending_permissions: Arc::new(std::sync::Mutex::new(HashMap::new())),
        }
    }

    /// Resolve a pending permission request with the user's selected option
    fn resolve_permission(&self, request_id: &str, selected_option: String) {
        let mut pending = self.pending_permissions.lock().unwrap();
        if let Some(sender) = pending.remove(request_id) {
            let _ = sender.send(selected_option);
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
            pending_map.insert(request_id.clone(), tx);
        }

        // Emit to frontend
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
    /// Current session ID
    current_session_id: Option<String>,
    /// Connection status
    status: SessionStatus,
    /// Project path
    project_path: String,
}

impl AcpProcess {
    /// Create a new ACP process manager
    pub fn new(project_path: String) -> Self {
        Self {
            command_tx: None,
            worker_handle: None,
            current_session_id: None,
            status: SessionStatus::Disconnected,
            project_path,
        }
    }

    /// Spawn the claude-code-acp process
    pub async fn spawn(&mut self, app_handle: AppHandle) -> Result<(), String> {
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
                run_acp_worker(command_rx, project_path, app_handle_clone).await;
            });
        });

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

        Ok(())
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

        self.current_session_id = Some(session_id.clone());
        self.emit_status(app_handle);

        Ok(session_id)
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
        let command_tx = self
            .command_tx
            .as_ref()
            .ok_or("Connection not established")?;

        command_tx
            .send(AcpCommand::RespondPermission {
                request_id: request_id.to_string(),
                selected_option,
            })
            .await
            .map_err(|_| "Failed to send respond_permission command")?;

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
}

/// Worker function that runs in a dedicated thread with LocalSet
async fn run_acp_worker(
    mut command_rx: mpsc::Receiver<AcpCommand>,
    project_path: String,
    app_handle: AppHandle,
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
    let client = Arc::new(PanagerAcpClient::new(app_handle.clone()));
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
            AcpCommand::NewSession { mode: _, reply } => {
                let result = create_new_session(&connection, &project_path).await;
                let _ = reply.send(result);
            }
            AcpCommand::SendPrompt {
                session_id,
                content,
                reply,
            } => {
                let result = send_prompt_to_session(&connection, &session_id, content).await;
                let _ = reply.send(result);
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
                client.resolve_permission(&request_id, selected_option);
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
) -> Result<String, String> {
    let cwd = PathBuf::from(project_path);
    let request = NewSessionRequest::new(cwd);

    let conn = connection.lock().await;
    let result = conn
        .new_session(request)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))?;

    Ok(result.session_id.to_string())
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
}

impl AcpState {
    pub fn new() -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create an ACP process for a project
    pub async fn get_or_create(&self, project_path: &str) -> Arc<Mutex<AcpProcess>> {
        let mut processes = self.processes.write().await;

        if let Some(process) = processes.get(project_path) {
            return Arc::clone(process);
        }

        let process = Arc::new(Mutex::new(AcpProcess::new(project_path.to_string())));
        processes.insert(project_path.to_string(), Arc::clone(&process));
        process
    }

    /// Remove an ACP process
    pub async fn remove(&self, project_path: &str) {
        let mut processes = self.processes.write().await;
        if let Some(process) = processes.remove(project_path) {
            let mut p = process.lock().await;
            p.disconnect().await;
        }
    }

    /// Disconnect all processes
    pub async fn disconnect_all(&self) {
        let mut processes = self.processes.write().await;
        for (_, process) in processes.drain() {
            let mut p = process.lock().await;
            p.disconnect().await;
        }
    }
}

impl Default for AcpState {
    fn default() -> Self {
        Self::new()
    }
}
