# Entry Processing Rules

This document defines the shared logic for processing ACP events into unified chat entries.
**Both backend and frontend MUST follow these rules** to ensure consistency between real-time
display and persisted state.

## Implementation Locations

| Location | File | Purpose |
|----------|------|---------|
| Backend | `src-tauri/src/acp/process.rs` | Persist entries to SQLite |
| Frontend | `src/ide/hooks/useAcpEvents.ts` | Real-time state updates |
| Types | `src/ide/types/acp.ts` | Shared type definitions |

## Entry Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `meta` | Session capabilities | `availableModes`, `availableModels`, `availableCommands`, `currentModeId`, `currentModelId` |
| `message` | User or assistant text | `role`, `content` |
| `thought` | Agent's internal reasoning | `content` |
| `tool_call` | Tool usage | `toolName`, `toolCallId`, `status`, `rawInput`, `output` |
| `permission_request` | Permission prompt | `requestId`, `toolName`, `description`, `options`, `responseOption` |
| `plan` | Agent's execution plan | `entries` (array of plan entries with content, priority, status) |
| `mode_change` | Mode switch notification | `previousModeId`, `newModeId` |

---

## RULE 1: Message Chunk Handling

**ACP Event**: `agent_message_chunk`

```
GET the ABSOLUTE LAST entry in entries array
IF last entry is an assistant message:
    newContent = extractNewContent(lastEntry.content, chunk.content)
    IF newContent is not null (not duplicate):
        APPEND newContent to lastEntry.content
ELSE:
    CREATE new message entry (role=assistant, content=chunk.content)
```

**Notes**:
- Backend accumulates chunks and updates DB entry incrementally
- Frontend checks if the **absolute last entry** is an assistant message (not just the last message entry!)
- IMPORTANT: Only append if the message is the last entry - if tool calls or other entries came after, create a new message
- Chunk content may be cumulative (full text so far) or delta (new text only)
- Detect duplicates by checking if chunk matches end of current content or is cumulative prefix

---

## RULE 2: Message End Detection

**ACP Event**: Any non-chunk event after streaming, or explicit `message_end`

```
IF is_streaming:
    FINALIZE streaming (clear streaming flag)
    # Content already accumulated in the entry
```

**Note**: ACP may not send explicit "message_end" - detect by receiving any other event type.

---

## RULE 3: Tool Call Creation

**ACP Event**: `tool_call`

```
FINALIZE any streaming message (RULE 2)
CREATE tool_call entry:
    toolCallId = event.tool_call_id
    toolName = cleanToolName(event.toolName)  # "mcp__acp__Read" → "Read"
    status = event.status (default: "pending")
    kind = event.kind
    rawInput = event.rawInput (JSON)
    title = event.title
```

**Tool Name Cleaning**: Strip MCP prefixes like `mcp__acp__` to get clean name.

---

## RULE 4: Tool Call Update

**ACP Event**: `tool_call_update`

```
FIND entry WHERE toolCallId = event.tool_call_id
UPDATE entry:
    status = event.status
    output = event.content (if small enough to store)
```

---

## RULE 5: Permission Request Creation

**ACP Event**: `request_permission`

```
FINALIZE any streaming message (RULE 2)
CREATE permission_request entry:
    requestId = event.request_id
    toolName = event.tool_name
    description = event.description
    options = event.options (JSON array)
    responseOption = NULL (not answered yet)
    responseTime = NULL
```

---

## RULE 6: Permission Response

**User Action**: User selects an option

```
FIND entry WHERE requestId = event.request_id
UPDATE entry:
    responseOption = selected_option_id
    responseTime = NOW()
SEND response to ACP backend
CLEAR pendingPermission state
```

---

## RULE 7: Session Capabilities (Meta Entry)

**ACP Event**: `session_capabilities` or from `new_session` response

```
CREATE meta entry:
    availableModes = event.modes.availableModes (JSON)
    availableModels = event.models.availableModels (JSON)
    currentModeId = event.modes.currentModeId
    currentModelId = event.models.currentModelId
```

**Note**: New meta entry each time capabilities change (preserves history).

---

## RULE 8: User Message

**User Action**: User sends a prompt

```
CREATE message entry:
    role = "user"
    content = user_input_text
```

---

## RULE 9: Thought Chunk Handling

**ACP Event**: `agent_thought_chunk`

```
GET the ABSOLUTE LAST entry in entries array
IF last entry is a thought:
    newContent = extractNewContent(lastEntry.content, chunk.content)
    IF newContent is not null (not duplicate):
        APPEND newContent to lastEntry.content
ELSE:
    CREATE new thought entry (content=chunk.content)
```

**Notes**:
- Similar to message chunks (RULE 1) but creates thought entries instead
- Backend uses `thought_streaming_states` (separate from message streaming)
- Frontend checks if the **absolute last entry** is a thought (not just the last thought entry!)
- IMPORTANT: Only append if the thought is the last entry - if other entries came after, create a new thought
- Thought end is detected when next event is not `agent_thought_chunk`
- In UI, thoughts are rendered as collapsible cards (collapsed by default)

---

## RULE 10: Plan Update

**ACP Event**: `plan`

```
CREATE plan entry:
    entries = event.entries (JSON array of plan items)
        each entry has: content, priority, status
```

**Notes**:
- Plans are sent as complete snapshots (all entries with current status)
- Each plan update creates a new entry (preserves history)
- UI displays the most recent plan entry
- Plan entries have priority: high, medium, low
- Plan entry status: pending, in_progress, completed

---

## RULE 11: Mode Change

**ACP Event**: `current_mode_update`

```
GET current mode from latest meta entry (or store state)
CREATE mode_change entry:
    previousModeId = current_mode_id (before change)
    newModeId = event.current_mode_id
UPDATE store: currentModeId = event.current_mode_id
```

**Notes**:
- Mode changes are displayed in the chat to show agent state transitions
- Common modes: agent, plan, etc.
- UI shows a small notification card for mode switches

---

## RULE 12: Available Commands Update

**ACP Event**: `available_commands_update`

```
UPDATE latest meta entry OR store state:
    availableCommands = event.available_commands (JSON array)
```

**Notes**:
- Commands are stored in meta/state but NOT displayed as chat entries
- Commands include: name, description, input specification
- Used by UI for command palette/autocomplete
- Not persisted as separate entry - updates current session state

---

## ID Handling

| Location | Entry ID Source |
|----------|-----------------|
| Backend | Auto-increment from SQLite (permanent) |
| Frontend (real-time) | `Date.now()` (temporary, for React keys) |
| Frontend (loaded) | From backend DB |

Frontend temp IDs don't need to match backend IDs - they're only used for React rendering.
When a session is loaded from DB, frontend uses the real backend IDs.

---

## Streaming State

### Frontend (Simplified)
Frontend uses a simple approach with no explicit streaming state:
- On each chunk, check the last entry of the appropriate type (message or thought)
- If matching type (assistant message or thought), append to its content
- If not, create a new entry
- Use `extractNewContent()` to detect and skip duplicate/cumulative chunks

### Backend
Backend tracks streaming per session with explicit state:
- `streaming_states: HashMap<SessionId, StreamingState>` for messages
- `thought_streaming_states: HashMap<SessionId, StreamingState>` for thoughts
- Finalizes streaming when receiving a non-chunk event type

---

## Maintaining These Rules

When modifying entry handling:

1. Update this documentation first
2. Implement in backend (`process.rs`)
3. Implement in frontend (`useAcpEvents.ts`)
4. Verify both implementations match
5. Add tests for new behavior

### Code Comments

Both implementations should reference the rules:

```rust
// See ENTRY_PROCESSING_RULES.md - RULE 3: Tool Call Creation
```

```typescript
// See ENTRY_PROCESSING_RULES.md - RULE 3: Tool Call Creation
```
