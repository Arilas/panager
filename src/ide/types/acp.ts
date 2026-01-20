/**
 * ACP (Agent Client Protocol) Type Definitions
 *
 * Types for communication with Claude Code via the ACP protocol.
 * Reference: https://agentclientprotocol.com
 *
 * IMPORTANT: This file defines the unified "entry" architecture.
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md
 * The frontend (useAcpEvents.ts) MUST use the same logic as backend (process.rs).
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

/** Session connection status (runtime only, not persisted) */
export type SessionStatus =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "prompting"
  | "error";

/** Chat session - uses ACP session ID directly as primary key */
export interface ChatSession {
  id: string;              // ACP session ID (same as DB primary key)
  name: string;
  projectPath: string;
  entries: ChatEntry[];    // Unified entries in chronological order
  createdAt: number;
  updatedAt: number;
}

/** Session info for listing (from backend) */
export interface DbSessionInfo {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  entryCount: number;
}

// ============================================================
// Entry Types (Unified Chat Items)
// See "Entry Processing Rules" in plan document
// ============================================================

/** Entry type discriminator */
export type EntryType = "meta" | "message" | "thought" | "tool_call" | "permission_request" | "plan" | "mode_change";

/** Base entry with common fields */
interface BaseEntry {
  id: number;           // Auto-increment from DB (for ordering)
  sessionId: string;    // ACP session ID
  type: EntryType;
  createdAt: number;
  updatedAt?: number;
}

/** Meta entry - session capabilities (RULE 7, RULE 12) */
export interface MetaEntry extends BaseEntry {
  type: "meta";
  availableModes: AcpSessionMode[];
  availableModels?: AcpSessionModel[];
  availableCommands?: AvailableCommand[];
  currentModeId: string;
  currentModelId?: string;
}

/** Available command definition (from ACP) */
export interface AvailableCommand {
  name: string;
  description: string;
  input?: {
    hint: string;
  };
}

/** Message entry - user or assistant message (RULE 1, RULE 8) */
export interface MessageEntry extends BaseEntry {
  type: "message";
  role: "user" | "assistant";
  content: string;  // Plain text or markdown (chunks already merged)
}

/** Thought entry - agent's internal reasoning (RULE 9) */
export interface ThoughtEntry extends BaseEntry {
  type: "thought";
  content: string;  // Agent's thinking/reasoning (chunks already merged)
}

/** Tool call entry (RULE 3, RULE 4) */
export interface ToolCallEntry extends BaseEntry {
  type: "tool_call";
  toolCallId: string;
  toolName: string;          // Read, Write, Bash, Grep, etc. (cleaned name)
  status: ToolCallStatus;    // pending, in_progress, completed, failed
  title?: string;
  kind?: ToolCallKind;       // read, edit, execute, fetch, search, think
  rawInput?: unknown;
  output?: unknown;          // Only if small enough
}

/** Permission request entry (RULE 5, RULE 6) */
export interface PermissionRequestEntry extends BaseEntry {
  type: "permission_request";
  requestId: string;
  toolName: string;
  description: string;
  options: PermissionOption[];
  responseOption?: string;   // Filled when answered
  responseTime?: number;     // Filled when answered
}

/** Plan entry - agent's execution plan (RULE 10) */
export interface PlanEntry extends BaseEntry {
  type: "plan";
  entries: PlanItem[];
}

/** Plan item (task in the plan) */
export interface PlanItem {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

/** Mode change entry - mode switch notification (RULE 11) */
export interface ModeChangeEntry extends BaseEntry {
  type: "mode_change";
  previousModeId: string;
  newModeId: string;
}

/** Union type for all entries */
export type ChatEntry = MetaEntry | MessageEntry | ThoughtEntry | ToolCallEntry | PermissionRequestEntry | PlanEntry | ModeChangeEntry;

// ============================================================
// Content Block Types (for sending prompts)
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

// ============================================================
// Legacy Types (for SDK compatibility)
// ============================================================

/** Legacy ToolCall type for ACP SDK events */
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

/** Legacy ChatMessage type (for SDK events) */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: ContentBlock[];
  timestamp: number;
  thoughts?: string[];
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
// Session Update Events (from ACP SDK)
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
  role: "user" | "assistant";
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
export interface ToolCallUpdateEvent extends BaseSessionUpdate {
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
  | ToolCallUpdateEvent
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
// Session Capabilities (Modes & Models from ACP)
// ============================================================

/** Available session mode from ACP */
export interface AcpSessionMode {
  id: string;
  name: string;
  description?: string;
}

/** Available session model from ACP */
export interface AcpSessionModel {
  modelId: string;
  name: string;
  description?: string;
}

/** Session capabilities (modes and models available for a session) */
export interface SessionCapabilities {
  /** Available modes for the session */
  availableModes: AcpSessionMode[];
  /** Current mode ID */
  currentModeId: string;
  /** Available models for the session (if model selection is supported) */
  availableModels?: AcpSessionModel[];
  /** Current model ID (if model selection is supported) */
  currentModelId?: string;
}

// ============================================================
// Database Types (from backend)
// ============================================================

/** DB Entry from backend (camelCase version) */
export interface DbEntry {
  id: number | null;
  sessionId: string;
  entryType: string;
  createdAt: number;
  updatedAt?: number;

  // Message fields
  role?: string;
  content?: string;

  // Tool call fields
  toolCallId?: string;
  toolName?: string;
  toolStatus?: string;
  toolInput?: string;
  toolOutput?: string;
  toolTitle?: string;
  toolKind?: string;

  // Permission request fields
  requestId?: string;
  requestToolName?: string;
  requestDescription?: string;
  requestOptions?: string;
  responseOption?: string;
  responseTime?: number;

  // Meta fields
  availableModes?: string;
  availableModels?: string;
  availableCommands?: string;
  currentModeId?: string;
  currentModelId?: string;

  // Plan fields
  planEntries?: string;

  // Mode change fields
  previousModeId?: string;
  newModeId?: string;
}

/** Session with entries from backend */
export interface DbSessionWithEntries {
  session: {
    id: string;
    name: string;
    projectPath: string;
    createdAt: number;
    updatedAt: number;
  };
  entries: DbEntry[];
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
export function isToolCallUpdate(update: SessionUpdate): update is ToolCallUpdateEvent {
  return update.type === "tool_call" || update.type === "tool_call_update";
}

/** Check if session update is plan */
export function isPlanUpdate(update: SessionUpdate): update is PlanUpdate {
  return update.type === "plan_update";
}

// Entry type guards
export function isMetaEntry(entry: ChatEntry): entry is MetaEntry {
  return entry.type === "meta";
}

export function isMessageEntry(entry: ChatEntry): entry is MessageEntry {
  return entry.type === "message";
}

export function isThoughtEntry(entry: ChatEntry): entry is ThoughtEntry {
  return entry.type === "thought";
}

export function isToolCallEntry(entry: ChatEntry): entry is ToolCallEntry {
  return entry.type === "tool_call";
}

export function isPermissionRequestEntry(entry: ChatEntry): entry is PermissionRequestEntry {
  return entry.type === "permission_request";
}

export function isPlanEntry(entry: ChatEntry): entry is PlanEntry {
  return entry.type === "plan";
}

export function isModeChangeEntry(entry: ChatEntry): entry is ModeChangeEntry {
  return entry.type === "mode_change";
}

// ============================================================
// Conversion Helpers
// ============================================================

/**
 * Convert a DB entry to a frontend ChatEntry
 * See "Entry Processing Rules" for field mappings
 */
export function parseDbEntry(dbEntry: DbEntry): ChatEntry {
  const base = {
    id: dbEntry.id ?? Date.now(),
    sessionId: dbEntry.sessionId,
    createdAt: dbEntry.createdAt,
    updatedAt: dbEntry.updatedAt,
  };

  switch (dbEntry.entryType) {
    case "message":
      return {
        ...base,
        type: "message",
        role: (dbEntry.role as "user" | "assistant") ?? "assistant",
        content: dbEntry.content ?? "",
      };

    case "thought":
      return {
        ...base,
        type: "thought",
        content: dbEntry.content ?? "",
      };

    case "tool_call":
      return {
        ...base,
        type: "tool_call",
        toolCallId: dbEntry.toolCallId ?? "",
        toolName: dbEntry.toolName ?? "Tool",
        status: (dbEntry.toolStatus as ToolCallStatus) ?? "completed",
        title: dbEntry.toolTitle,
        kind: dbEntry.toolKind as ToolCallKind | undefined,
        rawInput: dbEntry.toolInput ? JSON.parse(dbEntry.toolInput) : undefined,
        // tool_output is stored as plain text, not JSON
        output: dbEntry.toolOutput ?? undefined,
      };

    case "permission_request":
      return {
        ...base,
        type: "permission_request",
        requestId: dbEntry.requestId ?? "",
        toolName: dbEntry.requestToolName ?? "",
        description: dbEntry.requestDescription ?? "",
        options: dbEntry.requestOptions ? JSON.parse(dbEntry.requestOptions) : [],
        responseOption: dbEntry.responseOption ?? undefined,
        responseTime: dbEntry.responseTime ?? undefined,
      };

    case "meta":
      return {
        ...base,
        type: "meta",
        availableModes: dbEntry.availableModes ? JSON.parse(dbEntry.availableModes) : [],
        availableModels: dbEntry.availableModels ? JSON.parse(dbEntry.availableModels) : undefined,
        availableCommands: dbEntry.availableCommands ? JSON.parse(dbEntry.availableCommands) : undefined,
        currentModeId: dbEntry.currentModeId ?? "agent",
        currentModelId: dbEntry.currentModelId ?? undefined,
      };

    case "plan":
      return {
        ...base,
        type: "plan",
        entries: dbEntry.planEntries ? JSON.parse(dbEntry.planEntries) : [],
      };

    case "mode_change":
      return {
        ...base,
        type: "mode_change",
        previousModeId: dbEntry.previousModeId ?? "",
        newModeId: dbEntry.newModeId ?? "",
      };

    default:
      // Fallback to message entry
      return {
        ...base,
        type: "message",
        role: "assistant",
        content: `Unknown entry type: ${dbEntry.entryType}`,
      };
  }
}

/**
 * Clean tool name from ACP format
 * See "Entry Processing Rules" - RULE 3
 * "mcp__acp__Read" -> "Read"
 */
export function cleanToolName(rawName: string): string {
  return rawName.split("__").pop() ?? rawName;
}
