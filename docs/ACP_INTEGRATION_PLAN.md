# ACP (Agent Client Protocol) Integration Plan for Panager IDE

## Overview

Integrate Claude Code into Panager IDE via the Agent Client Protocol (ACP), enabling AI-assisted coding with chat interface, inline diff approval, and multiple agent modes.

**Key Integration:** Use `@zed-industries/claude-code-acp` (npm package) which wraps Claude Agent SDK and speaks ACP over stdio.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Panager IDE (React/Tauri)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Chat Panel   │  │ Tasks Panel  │  │ Chat Tab     │  │ Diff        │ │
│  │ (R.Sidebar)  │  │ (R.Sidebar)  │  │ (Editor)     │  │ Approval    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴────────┬────────┴─────────────────┘         │
│                                    │                                     │
│                          ┌─────────▼─────────┐                          │
│                          │  useAgentStore    │                          │
│                          │  (Zustand)        │                          │
│                          └─────────┬─────────┘                          │
│                                    │ Tauri invoke/listen                │
├────────────────────────────────────┼────────────────────────────────────┤
│                          ┌─────────▼─────────┐                          │
│                          │  ACP Module       │  Rust Backend            │
│                          │  (src-tauri/acp)  │                          │
│                          └─────────┬─────────┘                          │
│                                    │ JSON-RPC over stdio                │
├────────────────────────────────────┼────────────────────────────────────┤
│                          ┌─────────▼─────────┐                          │
│                          │ claude-code-acp   │  Child Process           │
│                          │ (Node.js via npx) │                          │
│                          └─────────┬─────────┘                          │
│                                    │                                     │
│                          ┌─────────▼─────────┐                          │
│                          │ Claude Agent SDK  │  → Anthropic API         │
│                          └───────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## User Requirements (Confirmed)

| Requirement | Choice |
|-------------|--------|
| Chat UI Location | Both sidebar AND tab |
| File Edit Approval | Inline diff view |
| Agent Modes | Plan, Agent, Ask (all three) |
| Architecture | Core feature (not plugin) |
| Terminal Output | Embedded in chat |
| Task Panel | Dedicated sidebar panel |
| Approval Workflow | Configurable |
| Agent Support | Claude Code only (initially) |
| Persistence | Full chat history |
| API Key | Not needed (claude-code-acp manages) |
| Context Mentions | Full @file, @symbol, @selection, @folder |

---

## Phase 1: Foundation - Types & Backend Infrastructure

### 1.1 Create ACP Types

**New file: `/src/ide/types/acp.ts`**

```typescript
// ACP Protocol (JSON-RPC 2.0)
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// Agent Modes (matching ACP spec)
export type AgentMode = "plan" | "agent" | "ask";

// Session Status
export type SessionStatus = "disconnected" | "connecting" | "ready" | "prompting" | "error";

// Content Blocks
export type ContentBlock = TextBlock | ImageBlock | ResourceBlock | ToolCallBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

export interface ResourceBlock {
  type: "resource";
  resource: { uri: string; name?: string; mimeType?: string };
}

// Tool Calls
export interface ToolCallBlock {
  type: "tool_call";
  toolCallId: string;
  title: string;
  kind: "think" | "read" | "edit" | "execute" | "fetch" | "search";
  status: "pending" | "in_progress" | "completed" | "failed";
  content: ToolCallContent;
  locations?: { uri: string; range?: LineRange }[];
}

export type ToolCallContent =
  | { type: "text"; text: string }
  | { type: "diff"; diff: DiffContent }
  | { type: "terminal"; terminalId: string; output: string };

export interface DiffContent {
  path: string;
  oldText: string;
  newText: string;
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: { type: "add" | "delete" | "context"; content: string }[];
}

// Messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: ContentBlock[];
  timestamp: number;
  thoughts?: string[];
}

// Sessions
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

// Agent Plan/Tasks
export interface AgentPlan {
  tasks: AgentTask[];
}

export interface AgentTask {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

// Context Mentions
export type ContextMention =
  | { type: "file"; path: string; displayName: string }
  | { type: "symbol"; name: string; kind: string; path: string; line: number }
  | { type: "selection"; path: string; startLine: number; endLine: number; content: string }
  | { type: "folder"; path: string; displayName: string };

// Pending Approvals
export interface PendingApproval {
  id: string;
  toolCallId: string;
  filePath: string;
  diff: DiffContent;
  status: "pending" | "approved" | "rejected";
}

export type ApprovalMode = "per_change" | "batch" | "auto";

// Right Sidebar
export type RightSidebarPanel = "chat" | "tasks" | null;
```

### 1.2 Add Chat Tab State

**Modify: `/src/ide/types/index.ts`**

```typescript
// Add to TabState union
export interface ChatTabState {
  type: "chat";
  path: string; // Format: "chat://{sessionId}"
  sessionId: string;
  sessionName: string;
}

export type TabState = FileTabState | DiffTabState | ChatTabState;

// Add type guard
export function isChatTab(tab: TabState | null | undefined): tab is ChatTabState {
  return tab?.type === "chat";
}
```

### 1.3 Rust Backend - ACP Module

**New directory: `/src-tauri/src/acp/`**

```
src-tauri/src/acp/
├── mod.rs          # Module exports
├── types.rs        # Serde types matching TypeScript
├── process.rs      # Process spawn & management
├── protocol.rs     # JSON-RPC handling
├── commands.rs     # Tauri commands
└── handlers.rs     # Client-side ACP handlers (fs, terminal)
```

**Key implementation in `process.rs`:**
- Spawn `claude-code-acp` via `npx` as child process
- Read stdout line-by-line (JSON-RPC messages)
- Write to stdin for requests
- Forward notifications to frontend via Tauri events

**Tauri Commands (`commands.rs`):**
```rust
#[tauri::command]
async fn acp_connect(project_path: String) -> Result<(), String>;

#[tauri::command]
async fn acp_disconnect() -> Result<(), String>;

#[tauri::command]
async fn acp_new_session(mode: String) -> Result<String, String>;

#[tauri::command]
async fn acp_send_prompt(session_id: String, content: Vec<ContentBlock>) -> Result<(), String>;

#[tauri::command]
async fn acp_cancel() -> Result<(), String>;

#[tauri::command]
async fn acp_set_mode(mode: String) -> Result<(), String>;

#[tauri::command]
async fn acp_respond_permission(request_id: String, approved: bool) -> Result<(), String>;

#[tauri::command]
async fn acp_list_sessions() -> Result<Vec<SessionInfo>, String>;

#[tauri::command]
async fn acp_load_session(session_id: String) -> Result<(), String>;
```

**Files to modify:**
- `/src-tauri/src/lib.rs` - Register ACP module and commands
- `/src-tauri/Cargo.toml` - Add serde_json, tokio-process dependencies

---

## Phase 2: Zustand Stores

### 2.1 Create Agent Store

**New file: `/src/ide/stores/agent.ts`**

```typescript
interface AgentState {
  // Connection
  status: SessionStatus;
  error: string | null;

  // Sessions
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;

  // Mode
  mode: AgentMode;

  // Plan
  currentPlan: AgentPlan | null;

  // Approvals
  pendingApprovals: PendingApproval[];
  approvalMode: ApprovalMode;

  // Streaming
  streamingMessage: Partial<ChatMessage> | null;
  streamingThoughts: string[];

  // Input
  inputValue: string;
  contextMentions: ContextMention[];

  // Actions
  connect: (projectPath: string) => Promise<void>;
  disconnect: () => Promise<void>;
  newSession: (name?: string) => Promise<string>;
  sendPrompt: () => Promise<void>;
  cancel: () => Promise<void>;
  setMode: (mode: AgentMode) => void;
  respondToPermission: (requestId: string, approved: boolean) => Promise<void>;

  // Internal
  _onSessionUpdate: (update: AcpSessionUpdate) => void;
}
```

Persisted fields: `sessions`, `approvalMode`, `mode`

### 2.2 Update IDE Store

**Modify: `/src/ide/stores/ide.ts`**

Add:
```typescript
// Right sidebar state
rightSidebarPanel: RightSidebarPanel;
rightSidebarWidth: number;
rightSidebarCollapsed: boolean;

// Actions
setRightSidebarPanel: (panel: RightSidebarPanel) => void;
toggleRightSidebar: () => void;
setRightSidebarWidth: (width: number) => void;
```

### 2.3 Update Editor Store

**Modify: `/src/ide/stores/editor.ts`**

Add action:
```typescript
openChatTab: (sessionId: string, sessionName: string) => void;
```

---

## Phase 3: UI Components

### 3.1 Layout Updates

**Modify: `/src/ide/components/layout/IdeLayout.tsx`**

Add RightActivityBar and RightSidebar:

```
┌─────────────────────────────────────────────────────────────────┐
│ TitleBar                                                        │
├────┬─────────┬──────────────────────┬─────────────┬─────────────┤
│ AB │ Sidebar │ ContentArea          │ RightSidebar│ RightAB     │
│    │         │                      │             │ [💬][📋]    │
│    │         │                      │             │             │
├────┴─────────┴──────────────────────┴─────────────┴─────────────┤
│ StatusBar                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 New Components

**Directory: `/src/ide/components/agent/`**

| Component | Purpose |
|-----------|---------|
| `ChatPanel.tsx` | Main chat UI (used in sidebar & tab) |
| `ChatInput.tsx` | Input with @mention autocomplete |
| `ChatMessage.tsx` | Message container |
| `UserMessage.tsx` | User message display |
| `AssistantMessage.tsx` | Assistant with tool calls |
| `ToolCallCard.tsx` | Tool execution display |
| `DiffApprovalCard.tsx` | Inline diff with accept/reject |
| `TerminalOutput.tsx` | Terminal output in chat |
| `TasksPanel.tsx` | Agent plan/tasks sidebar |
| `TaskItem.tsx` | Individual task row |
| `ModeSelector.tsx` | Plan/Agent/Ask toggle |
| `MentionAutocomplete.tsx` | @mention dropdown |
| `ContextBadge.tsx` | Context mention chip |
| `ApprovalBanner.tsx` | Pending approvals notice |

**Directory: `/src/ide/components/layout/`**

| Component | Purpose |
|-----------|---------|
| `RightSidebar.tsx` | Right sidebar container |
| `RightActivityBar.tsx` | Chat/Tasks icons |

### 3.3 Key Component: DiffApprovalCard

```typescript
export function DiffApprovalCard({ approval }: Props) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header with file path and actions */}
      <div className="flex justify-between items-center p-2 bg-muted">
        <span className="font-mono text-sm">{approval.filePath}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={openInEditor}>
            <Expand className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={reject}>
            <X className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={approve}>
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {/* Inline diff display */}
      <DiffView hunks={approval.diff.hunks} />
    </div>
  );
}
```

---

## Phase 4: Event Handling

### 4.1 ACP Events Hook

**New file: `/src/ide/hooks/useAcpEvents.ts`**

Listen to Tauri events:
- `acp:status` - Connection status changes
- `acp:session_update` - Message chunks, tool calls, plans
- `acp:permission_request` - Tool permission requests
- `acp:error` - Errors

### 4.2 Tauri API Wrapper

**New file: `/src/ide/lib/tauri-acp.ts`**

Typed wrappers for all ACP Tauri commands.

---

## Phase 5: File Edit Workflow

### 5.1 Flow

1. Claude produces file edit → `acp:session_update` with tool_call (kind: "edit")
2. Backend parses diff, creates PendingApproval
3. Store adds to `pendingApprovals` array
4. UI shows DiffApprovalCard inline in chat
5. User clicks Accept → `acp_respond_permission` → Backend writes file
6. User clicks Reject → `acp_respond_permission` → Backend skips

### 5.2 Approval Modes

| Mode | Behavior |
|------|----------|
| `per_change` | Each diff requires explicit Accept/Reject |
| `batch` | Diffs queue up, review all at once |
| `auto` | Auto-approve, show diffs as confirmation |

### 5.3 Monaco Integration

"View in Editor" button opens DiffTab with approval metadata:

```typescript
openDiffTab({
  type: "diff",
  path: `diff://${approval.filePath}`,
  fileName: basename(approval.filePath),
  originalContent: approval.diff.oldText,
  modifiedContent: approval.diff.newText,
  staged: false,
  // Extension for approval
  approvalId: approval.id,
});
```

---

## Phase 6: Settings

### 6.1 Agent Settings

**Modify: `/src/ide/types/settings.ts`**

```typescript
interface IdeSettings {
  // ... existing ...
  agent: {
    defaultMode: AgentMode;
    approvalMode: ApprovalMode;
    showThoughts: boolean;
    autoConnect: boolean;
  };
}
```

### 6.2 Settings UI

**New file: `/src/ide/components/settings/AgentSettingsTab.tsx`**

Settings for:
- Default mode (Plan/Agent/Ask)
- Approval mode
- Show agent thoughts
- Auto-connect on project open

---

## Phase 7: Chat Tab Support

### 7.1 Editor Store

Add `openChatTab` action that creates ChatTabState.

### 7.2 ContentArea

**Modify: `/src/ide/components/layout/ContentArea.tsx`**

```typescript
{isChatTab(activeTab) ? (
  <ChatPanel isTab sessionId={activeTab.sessionId} />
) : isDiffTab(activeTab) ? (
  <DiffEditor {...} />
) : (
  <MonacoEditor {...} />
)}
```

### 7.3 EditorTabs

Update to render chat tabs with conversation icon.

---

## Phase 8: Context Mentions

### 8.1 Mention Providers

| Type | Source |
|------|--------|
| `@file` | `searchFileNames()` from existing search |
| `@symbol` | LSP workspace symbols |
| `@selection` | Current editor selection |
| `@folder` | Directory listing |

### 8.2 Autocomplete Trigger

When user types `@` in ChatInput:
1. Show autocomplete dropdown
2. Filter by typed text after `@`
3. On select, add to `contextMentions` array
4. Display as badges above input

---

## Phase 9: Session Persistence

### 9.1 Storage

Sessions persisted via Zustand persist middleware to localStorage.

For full history, consider SQLite via existing Tauri plugin:
- Table: `chat_sessions` (id, name, project_path, created_at, updated_at)
- Table: `chat_messages` (id, session_id, role, content_json, timestamp)

### 9.2 Session Management UI

- Session list in chat panel header dropdown
- "New Chat" button
- Session rename/delete options

---

## Files Summary

### New Files

| Path | Purpose |
|------|---------|
| `/src/ide/types/acp.ts` | ACP protocol types |
| `/src/ide/stores/agent.ts` | Agent state management |
| `/src/ide/hooks/useAcpEvents.ts` | ACP event listeners |
| `/src/ide/lib/tauri-acp.ts` | Tauri command wrappers |
| `/src/ide/components/agent/*.tsx` | All chat/agent UI components |
| `/src/ide/components/layout/RightSidebar.tsx` | Right sidebar container |
| `/src/ide/components/layout/RightActivityBar.tsx` | Right activity bar |
| `/src/ide/components/settings/AgentSettingsTab.tsx` | Agent settings |
| `/src-tauri/src/acp/mod.rs` | Rust ACP module |
| `/src-tauri/src/acp/types.rs` | Rust ACP types |
| `/src-tauri/src/acp/process.rs` | Process management |
| `/src-tauri/src/acp/protocol.rs` | JSON-RPC handling |
| `/src-tauri/src/acp/commands.rs` | Tauri commands |
| `/src-tauri/src/acp/handlers.rs` | FS/terminal handlers |

### Modified Files

| Path | Changes |
|------|---------|
| `/src/ide/types/index.ts` | Add ChatTabState, isChatTab |
| `/src/ide/types/settings.ts` | Add agent settings |
| `/src/ide/stores/ide.ts` | Add right sidebar state |
| `/src/ide/stores/editor.ts` | Add openChatTab action |
| `/src/ide/components/layout/IdeLayout.tsx` | Add right sidebar |
| `/src/ide/components/layout/ContentArea.tsx` | Handle chat tabs |
| `/src/ide/components/editor/EditorTabs.tsx` | Render chat tabs |
| `/src/ide/IdeApp.tsx` | Initialize ACP events hook |
| `/src-tauri/src/lib.rs` | Register ACP commands |
| `/src-tauri/Cargo.toml` | Add dependencies |

---

## Verification Plan

### Manual Testing

1. **Connection**: Start IDE, verify `claude-code-acp` spawns
2. **New Session**: Create session, verify mode selector works
3. **Chat**: Send message, verify streaming response
4. **File Edit**: Trigger edit, verify inline diff approval
5. **Approval Flow**: Test accept/reject/batch modes
6. **Context Mentions**: Test @file, @symbol, @selection
7. **Tasks Panel**: Verify plan/tasks display
8. **Chat Tab**: Open chat in tab, verify full functionality
9. **Persistence**: Close/reopen, verify session restored
10. **Settings**: Change approval mode, verify behavior

### Automated Tests

- Unit tests for ACP type parsing
- Unit tests for diff display logic
- Integration tests for Tauri commands
- E2E tests for chat flow

---

## Dependencies

### npm (frontend)
- No new dependencies (uses existing React, Zustand, Radix)

### Cargo (backend)
- `serde_json` (already present)
- `tokio` with `process` feature
- `uuid` for session IDs

### Process Management

**Use `npx` to run claude-code-acp** (similar to TypeScript LSP approach):

```rust
// In process.rs
Command::new("npx")
    .args(["@zed-industries/claude-code-acp"])
    .current_dir(project_path)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
```

Benefits:
- No global installation required
- Always uses latest version
- Consistent with existing TypeScript LSP pattern in codebase
- User just needs `ANTHROPIC_API_KEY` environment variable set

---

## Implementation Order

1. **Phase 1**: Types & Rust backend (foundation)
2. **Phase 2**: Zustand stores
3. **Phase 3**: Basic UI (ChatPanel, RightSidebar)
4. **Phase 4**: Event handling (connect everything)
5. **Phase 5**: File edit workflow (core feature)
6. **Phase 6**: Settings integration
7. **Phase 7**: Chat tab support
8. **Phase 8**: Context mentions
9. **Phase 9**: Session persistence

Each phase builds on the previous, with Phase 4 being the integration point where the system becomes functional.

---

## References

- [ACP Specification](https://agentclientprotocol.com)
- [Claude Code ACP Adapter](https://github.com/zed-industries/claude-code-acp)
- [Zed External Agents Documentation](https://zed.dev/docs/ai/external-agents)
- [Claude Code via ACP Blog Post](https://zed.dev/blog/claude-code-via-acp)
