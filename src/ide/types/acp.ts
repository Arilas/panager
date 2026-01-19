/**
 * ACP (Agent Client Protocol) Type Definitions
 *
 * Types for communication with Claude Code via the ACP protocol.
 * Reference: https://agentclientprotocol.com
 */

// ============================================================
// JSON-RPC 2.0 Protocol Types
// ============================================================

/** JSON-RPC 2.0 request message */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 response message */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 notification (no id) */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 error object */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Union type for all JSON-RPC messages */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ============================================================
// Agent Modes
// ============================================================

/** Agent operating modes */
export type AgentMode = "plan" | "agent" | "ask";

/** Human-readable labels for agent modes */
export const AgentModeLabels: Record<AgentMode, string> = {
  plan: "Plan",
  agent: "Agent",
  ask: "Ask",
};

/** Descriptions for agent modes */
export const AgentModeDescriptions: Record<AgentMode, string> = {
  plan: "Read-only planning and analysis",
  agent: "Full automation with file editing",
  ask: "Q&A and explanations only",
};

// ============================================================
// Session Types
// ============================================================

/** Session connection status */
export type SessionStatus =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "prompting"
  | "error";

/** Chat session */
export interface ChatSession {
  id: string;
  name: string;
  mode: AgentMode;
  messages: ChatMessage[];
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  projectPath: string;
}

/** Session info for listing */
export interface SessionInfo {
  id: string;
  name: string;
  mode: AgentMode;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// ============================================================
// Content Block Types
// ============================================================

/** Text content block */
export interface TextBlock {
  type: "text";
  text: string;
}

/** Image content block */
export interface ImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

/** Resource reference block */
export interface ResourceBlock {
  type: "resource";
  resource: {
    uri: string;
    name?: string;
    mimeType?: string;
    text?: string;
  };
}

/** Resource link block (reference without content) */
export interface ResourceLinkBlock {
  type: "resource_link";
  uri: string;
  name?: string;
  mimeType?: string;
}

/** Union type for all content blocks */
export type ContentBlock = TextBlock | ImageBlock | ResourceBlock | ResourceLinkBlock;

// ============================================================
// Tool Call Types
// ============================================================

/** Tool call kind (for UI categorization) */
export type ToolCallKind =
  | "think"    // Internal reasoning
  | "read"     // File/content reading
  | "edit"     // File modifications
  | "execute"  // Terminal commands
  | "fetch"    // Web fetching
  | "search";  // Search operations

/** Tool call execution status */
export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

/** Line range for locations */
export interface LineRange {
  start: { line: number; column?: number };
  end: { line: number; column?: number };
}

/** Location reference in tool calls */
export interface ToolCallLocation {
  uri: string;
  range?: LineRange;
}

/** Diff content for file edits */
export interface DiffContent {
  path: string;
  oldText: string;
  newText: string;
  hunks?: DiffHunk[];
}

/** Diff hunk (section of changes) */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/** Individual diff line */
export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** Terminal output content */
export interface TerminalContent {
  terminalId: string;
  output: string;
  exitCode?: number;
}

/** Tool call content variants */
export type ToolCallContent =
  | { type: "text"; text: string }
  | { type: "diff"; diff: DiffContent }
  | { type: "terminal"; terminal: TerminalContent };

/** Tool call representation */
export interface ToolCall {
  toolCallId: string;
  name: string;
  title: string;
  kind: ToolCallKind;
  status: ToolCallStatus;
  content?: ToolCallContent;
  locations?: ToolCallLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
}

// ============================================================
// Message Types
// ============================================================

/** Message role */
export type MessageRole = "user" | "assistant";

/** Chat message */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  timestamp: number;
  toolCalls?: ToolCall[];
  thoughts?: string[];
}

/** Streaming message chunk (partial message during streaming) */
export interface StreamingMessageChunk {
  sessionId: string;
  messageId: string;
  role: MessageRole;
  contentDelta?: string;
  thoughtDelta?: string;
  toolCall?: ToolCall;
  done?: boolean;
}

// ============================================================
// Agent Plan/Tasks
// ============================================================

/** Task status */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

/** Agent task */
export interface AgentTask {
  id: string;
  content: string;
  status: TaskStatus;
  priority?: number;
}

/** Agent plan */
export interface AgentPlan {
  tasks: AgentTask[];
}

// ============================================================
// Context Mentions
// ============================================================

/** File mention */
export interface FileMention {
  type: "file";
  path: string;
  displayName: string;
}

/** Symbol mention */
export interface SymbolMention {
  type: "symbol";
  name: string;
  kind: string;
  path: string;
  line: number;
}

/** Selection mention */
export interface SelectionMention {
  type: "selection";
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

/** Folder mention */
export interface FolderMention {
  type: "folder";
  path: string;
  displayName: string;
}

/** Union type for all context mentions */
export type ContextMention = FileMention | SymbolMention | SelectionMention | FolderMention;

// ============================================================
// Approval Workflow
// ============================================================

/** Approval workflow mode */
export type ApprovalMode = "per_change" | "batch" | "auto";

/** Approval mode labels */
export const ApprovalModeLabels: Record<ApprovalMode, string> = {
  per_change: "Per Change",
  batch: "Batch Review",
  auto: "Auto Approve",
};

/** Approval mode descriptions */
export const ApprovalModeDescriptions: Record<ApprovalMode, string> = {
  per_change: "Approve each file change individually",
  batch: "Review and approve changes in batches",
  auto: "Automatically approve all changes",
};

/** Pending approval status */
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** Pending file approval */
export interface PendingApproval {
  id: string;
  toolCallId: string;
  filePath: string;
  diff: DiffContent;
  status: ApprovalStatus;
  createdAt: number;
}

// ============================================================
// Permission Request
// ============================================================

/** Permission request from agent */
export interface PermissionRequest {
  requestId: string;
  toolName: string;
  description: string;
  options: PermissionOption[];
}

/** Permission option */
export interface PermissionOption {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

// ============================================================
// Session Update Events
// ============================================================

/** Session update event types */
export type SessionUpdateType =
  | "message_chunk"
  | "thought_chunk"
  | "tool_call"
  | "tool_call_update"
  | "plan_update"
  | "mode_update"
  | "commands_update"
  | "status_update"
  | "error";

/** Base session update */
interface BaseSessionUpdate {
  sessionId: string;
  type: SessionUpdateType;
}

/** Message chunk update */
export interface MessageChunkUpdate extends BaseSessionUpdate {
  type: "message_chunk";
  messageId: string;
  role: MessageRole;
  content: string;
  done?: boolean;
}

/** Thought chunk update */
export interface ThoughtChunkUpdate extends BaseSessionUpdate {
  type: "thought_chunk";
  messageId: string;
  thought: string;
}

/** Tool call update */
export interface ToolCallUpdate extends BaseSessionUpdate {
  type: "tool_call" | "tool_call_update";
  toolCall: ToolCall;
}

/** Plan update */
export interface PlanUpdate extends BaseSessionUpdate {
  type: "plan_update";
  plan: AgentPlan;
}

/** Mode update */
export interface ModeUpdate extends BaseSessionUpdate {
  type: "mode_update";
  mode: AgentMode;
}

/** Available commands update */
export interface CommandsUpdate extends BaseSessionUpdate {
  type: "commands_update";
  commands: SlashCommand[];
}

/** Status update */
export interface StatusUpdate extends BaseSessionUpdate {
  type: "status_update";
  status: SessionStatus;
  error?: string;
}

/** Error update */
export interface ErrorUpdate extends BaseSessionUpdate {
  type: "error";
  error: string;
  code?: number;
}

/** Union type for all session updates */
export type SessionUpdate =
  | MessageChunkUpdate
  | ThoughtChunkUpdate
  | ToolCallUpdate
  | PlanUpdate
  | ModeUpdate
  | CommandsUpdate
  | StatusUpdate
  | ErrorUpdate;

// ============================================================
// Slash Commands
// ============================================================

/** Slash command definition */
export interface SlashCommand {
  name: string;
  description: string;
  args?: SlashCommandArg[];
}

/** Slash command argument */
export interface SlashCommandArg {
  name: string;
  description?: string;
  required?: boolean;
}

// ============================================================
// Right Sidebar
// ============================================================

/** Right sidebar panel type */
export type RightSidebarPanel = "chat" | "tasks" | null;

// ============================================================
// ACP Capabilities
// ============================================================

/** Client capabilities */
export interface ClientCapabilities {
  fileSystem?: {
    read?: boolean;
    write?: boolean;
  };
  terminal?: boolean;
  images?: boolean;
  embeddedContext?: boolean;
}

/** Agent capabilities */
export interface AgentCapabilities {
  images?: boolean;
  audio?: boolean;
  embeddedContext?: boolean;
  mcpServers?: boolean;
  sessionLoad?: boolean;
  sessionFork?: boolean;
  modes?: AgentMode[];
}

// ============================================================
// Initialize Types
// ============================================================

/** Initialize request params */
export interface InitializeParams {
  protocolVersion: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: ClientCapabilities;
  workingDirectory: string;
}

/** Initialize response */
export interface InitializeResult {
  protocolVersion: string;
  agentInfo: {
    name: string;
    version: string;
  };
  capabilities: AgentCapabilities;
}

// ============================================================
// Type Guards
// ============================================================

/** Check if content block is text */
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === "text";
}

/** Check if content block is image */
export function isImageBlock(block: ContentBlock): block is ImageBlock {
  return block.type === "image";
}

/** Check if content block is resource */
export function isResourceBlock(block: ContentBlock): block is ResourceBlock {
  return block.type === "resource";
}

/** Check if tool call content is diff */
export function isDiffContent(
  content: ToolCallContent
): content is { type: "diff"; diff: DiffContent } {
  return content.type === "diff";
}

/** Check if tool call content is terminal */
export function isTerminalContent(
  content: ToolCallContent
): content is { type: "terminal"; terminal: TerminalContent } {
  return content.type === "terminal";
}

/** Check if session update is message chunk */
export function isMessageChunkUpdate(update: SessionUpdate): update is MessageChunkUpdate {
  return update.type === "message_chunk";
}

/** Check if session update is tool call */
export function isToolCallUpdate(update: SessionUpdate): update is ToolCallUpdate {
  return update.type === "tool_call" || update.type === "tool_call_update";
}

/** Check if session update is plan */
export function isPlanUpdate(update: SessionUpdate): update is PlanUpdate {
  return update.type === "plan_update";
}
