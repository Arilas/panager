//! ACP type definitions matching the TypeScript types
//!
//! These types are used for serialization/deserialization of ACP protocol messages.

use serde::{Deserialize, Serialize};
use specta::Type;

// ============================================================
// JSON-RPC 2.0 Protocol Types
// ============================================================

/// JSON-RPC 2.0 request message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: JsonRpcId,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// JSON-RPC 2.0 response message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<JsonRpcId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 2.0 notification (no id)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// JSON-RPC ID can be string or number
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum JsonRpcId {
    String(String),
    Number(i64),
}

/// JSON-RPC 2.0 error object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

// ============================================================
// Agent Modes
// ============================================================

/// Agent operating modes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    Plan,
    Agent,
    Ask,
}

impl Default for AgentMode {
    fn default() -> Self {
        Self::Agent
    }
}

// ============================================================
// Session Types
// ============================================================

/// Session connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Disconnected,
    Connecting,
    Initializing,
    Ready,
    Prompting,
    Error,
}

impl Default for SessionStatus {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Session info for listing (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub mode: AgentMode,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
}

// ============================================================
// Content Block Types
// ============================================================

/// Text content block
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TextBlock {
    pub text: String,
}

/// Image content block
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageBlock {
    pub source: ImageSource,
}

/// Image source
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageSource {
    #[serde(rename = "type")]
    pub source_type: String, // "base64"
    pub media_type: String,
    pub data: String,
}

/// Resource reference block
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResourceBlock {
    pub resource: ResourceInfo,
}

/// Resource information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInfo {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// Union type for content blocks
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text(TextBlock),
    Image(ImageBlock),
    Resource(ResourceBlock),
    ResourceLink {
        uri: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
    },
}

// ============================================================
// Tool Call Types
// ============================================================

/// Tool call kind (for UI categorization)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ToolCallKind {
    Think,
    Read,
    Edit,
    Execute,
    Fetch,
    Search,
}

/// Tool call execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ToolCallStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

/// Line range for locations
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineRange {
    pub start: Position,
    pub end: Position,
}

/// Position in a file
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub line: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<u32>,
}

/// Location reference in tool calls
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallLocation {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<LineRange>,
}

/// Diff content for file edits
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffContent {
    pub path: String,
    pub old_text: String,
    pub new_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hunks: Option<Vec<DiffHunk>>,
}

/// Diff hunk (section of changes)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

/// Individual diff line
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: DiffLineType,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_line_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_line_number: Option<u32>,
}

/// Diff line type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    Add,
    Delete,
    Context,
}

/// Terminal output content
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TerminalContent {
    pub terminal_id: String,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
}

/// Tool call content variants
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolCallContent {
    Text { text: String },
    Diff { diff: DiffContent },
    Terminal { terminal: TerminalContent },
}

/// Tool call representation
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub tool_call_id: String,
    pub name: String,
    pub title: String,
    pub kind: ToolCallKind,
    pub status: ToolCallStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<ToolCallContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locations: Option<Vec<ToolCallLocation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_input: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_output: Option<serde_json::Value>,
}

// ============================================================
// Message Types
// ============================================================

/// Message role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

/// Chat message (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: MessageRole,
    pub content: Vec<ContentBlock>,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thoughts: Option<Vec<String>>,
}

// ============================================================
// Agent Plan/Tasks
// ============================================================

/// Task status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

/// Agent task
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AgentTask {
    pub id: String,
    pub content: String,
    pub status: TaskStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,
}

/// Agent plan
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AgentPlan {
    pub tasks: Vec<AgentTask>,
}

// ============================================================
// Approval Workflow
// ============================================================

/// Approval workflow mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalMode {
    PerChange,
    Batch,
    Auto,
}

impl Default for ApprovalMode {
    fn default() -> Self {
        Self::PerChange
    }
}

/// Pending approval status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
}

/// Pending file approval (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PendingApproval {
    pub id: String,
    pub tool_call_id: String,
    pub file_path: String,
    pub diff: DiffContent,
    pub status: ApprovalStatus,
    pub created_at: i64,
}

// ============================================================
// Permission Request
// ============================================================

/// Permission request from agent (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub request_id: String,
    pub tool_name: String,
    pub description: String,
    pub options: Vec<PermissionOption>,
}

/// Permission option
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PermissionOption {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
}

// ============================================================
// Session Update Events (sent to frontend via Tauri events)
// ============================================================

/// Session update event (union type for Tauri events)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionUpdate {
    MessageChunk {
        session_id: String,
        message_id: String,
        role: MessageRole,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        done: Option<bool>,
    },
    ThoughtChunk {
        session_id: String,
        message_id: String,
        thought: String,
    },
    ToolCall {
        session_id: String,
        tool_call: ToolCall,
    },
    ToolCallUpdate {
        session_id: String,
        tool_call: ToolCall,
    },
    PlanUpdate {
        session_id: String,
        plan: AgentPlan,
    },
    ModeUpdate {
        session_id: String,
        mode: AgentMode,
    },
    StatusUpdate {
        session_id: String,
        status: SessionStatus,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    PermissionRequest {
        session_id: String,
        request: PermissionRequest,
    },
    Error {
        session_id: String,
        error: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<i32>,
    },
}

// ============================================================
// Slash Commands
// ============================================================

/// Slash command definition
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommand {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<SlashCommandArg>>,
}

/// Slash command argument
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandArg {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

// ============================================================
// Context Mentions (from frontend)
// ============================================================

/// Context mention (union type from frontend)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ContextMention {
    File {
        path: String,
        display_name: String,
    },
    Symbol {
        name: String,
        kind: String,
        path: String,
        line: u32,
    },
    Selection {
        path: String,
        start_line: u32,
        end_line: u32,
        content: String,
    },
    Folder {
        path: String,
        display_name: String,
    },
}

// ============================================================
// ACP Capabilities
// ============================================================

/// Client capabilities (sent during initialize)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_system: Option<FileSystemCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terminal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_context: Option<bool>,
}

/// File system capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub write: Option<bool>,
}

/// Agent capabilities (received during initialize)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_context: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_load: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_fork: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modes: Option<Vec<AgentMode>>,
}

// ============================================================
// Session Capabilities (Modes & Models from ACP)
// ============================================================

/// Available session mode from ACP
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionMode {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Available session model from ACP
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionModel {
    pub model_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Session capabilities (modes and models available for a session)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionCapabilities {
    /// Available modes for the session
    pub available_modes: Vec<AcpSessionMode>,
    /// Current mode ID
    pub current_mode_id: String,
    /// Available models for the session (if model selection is supported)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_models: Option<Vec<AcpSessionModel>>,
    /// Current model ID (if model selection is supported)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_model_id: Option<String>,
}
