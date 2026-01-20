/**
 * ACP Events Hook
 *
 * Listens to Tauri events from the ACP backend and updates the agent store.
 *
 * IMPORTANT: This file implements the Entry Processing Rules.
 * The frontend MUST use the same logic as backend (process.rs).
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md
 */

import { useEffect, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentStore, createChatSession, createPromptContent, createUserMessageEntry } from "../stores/agent";
import { useIdeStore } from "../stores/ide";
import type {
  SessionStatus,
  PermissionRequest,
  SessionCapabilities,
  ToolCallKind,
  ToolCallStatus,
  MessageEntry,
  ThoughtEntry,
  ToolCallEntry,
  MetaEntry,
  PermissionRequestEntry,
  PlanEntry,
  PlanItem,
  ModeChangeEntry,
  ChatEntry,
} from "../types/acp";
import { cleanToolName, isMessageEntry, isThoughtEntry } from "../types/acp";
import {
  acpConnect,
  acpNewSession,
  acpResumeSession,
  acpSendPrompt,
  acpSetMode,
  acpCancel,
  acpRespondPermission,
} from "../lib/tauri-acp";

// Event names matching the Rust backend
const ACP_STATUS = "acp:status";
const ACP_SESSION_UPDATE = "acp:session_update";
const ACP_PERMISSION_REQUEST = "acp:permission_request";
const ACP_SESSION_CAPABILITIES = "acp:session_capabilities";
const ACP_MESSAGE_END = "acp:message_end";
const ACP_ERROR = "acp:error";

/**
 * Session notification payload from the SDK
 * The SDK sends SessionNotification which contains various update types
 * Note: The SDK uses camelCase (sessionId) not snake_case
 */
interface SessionNotificationPayload {
  sessionId: string;      // camelCase from SDK
  session_id?: string;    // snake_case fallback (if serde renames it)
  update?: SessionUpdate;
  [key: string]: unknown;
}

/** Session update types from the ACP SDK */
type SessionUpdateType =
  | "agent_message_chunk"
  | "agent_message_end"  // May not be sent by SDK, status change to "ready" signals completion
  | "agent_thought_chunk"
  | "tool_call"
  | "tool_call_update"
  | "plan"
  | "available_commands_update"
  | "current_mode_update"
  | "error";

interface SessionUpdate {
  sessionUpdate: SessionUpdateType;
  content?: { type: string; text?: string };
  toolUse?: unknown;
  toolResult?: unknown;
  plan?: unknown;
  error?: string;
  // Tool call fields from ACP SDK
  toolCallId?: string;
  title?: string;
  kind?: string;
  status?: string;
  locations?: Array<{ uri: string; range?: unknown }>;
  rawInput?: unknown;
  _meta?: {
    claudeCode?: {
      toolName?: string;
    };
  };
}

/**
 * Map ACP tool kind string to our ToolCallKind type
 */
function mapToolKind(kind: string | undefined): ToolCallKind {
  const normalized = kind?.toLowerCase() || "read";
  switch (normalized) {
    case "think": return "think";
    case "read": return "read";
    case "edit": return "edit";
    case "execute": return "execute";
    case "fetch": return "fetch";
    case "search": return "search";
    default: return "read";
  }
}

/**
 * Map ACP tool status string to our ToolCallStatus type
 */
function mapToolStatus(status: string | undefined): ToolCallStatus {
  const normalized = status?.toLowerCase() || "pending";
  switch (normalized) {
    case "pending": return "pending";
    case "in_progress": case "inprogress": return "in_progress";
    case "completed": return "completed";
    case "failed": return "failed";
    default: return "pending";
  }
}

/**
 * Get the last entry if it matches the specified type
 * IMPORTANT: Only returns the entry if it is the ABSOLUTE LAST entry in the array
 * This prevents accidentally updating an older message when tool calls have been added after it
 */
function getLastEntryIfType(entries: ChatEntry[], type: "message" | "thought"): (MessageEntry | ThoughtEntry) | null {
  if (entries.length === 0) return null;
  const lastEntry = entries[entries.length - 1];
  if (lastEntry.type === type) {
    return lastEntry as MessageEntry | ThoughtEntry;
  }
  return null;
}

/**
 * Check if new chunk text is a duplicate by comparing with current content
 * The SDK may send cumulative chunks - if the new text ends with what we already have, extract only the new part
 */
function extractNewContent(currentContent: string, newChunk: string): string | null {
  // If chunk is shorter or equal and matches the end of current, it's a duplicate
  if (newChunk.length <= currentContent.length) {
    if (currentContent.endsWith(newChunk) || currentContent === newChunk) {
      return null; // Duplicate
    }
  }

  // If chunk is longer and starts with current content, extract the new part (cumulative)
  if (newChunk.startsWith(currentContent)) {
    return newChunk.slice(currentContent.length);
  }

  // Otherwise it's truly new content (delta chunk)
  return newChunk;
}

/**
 * Hook to manage ACP event subscriptions and provide connection methods
 *
 * IMPORTANT: Event handling follows the same rules as backend (process.rs).
 * See "Entry Processing Rules" in plan document.
 */
export function useAcpEvents() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const projectPath = projectContext?.projectPath;

  // Agent store actions
  const setStatus = useAgentStore((s) => s.setStatus);
  const setError = useAgentStore((s) => s.setError);
  const setPendingPermission = useAgentStore((s) => s.setPendingPermission);
  const setSessionCapabilities = useAgentStore((s) => s.setSessionCapabilities);
  const storeCreateSession = useAgentStore((s) => s.createSession);
  const addEntry = useAgentStore((s) => s.addEntry);
  const updateEntryByToolCallId = useAgentStore((s) => s.updateEntryByToolCallId);
  const updateEntryByRequestId = useAgentStore((s) => s.updateEntryByRequestId);
  const mode = useAgentStore((s) => s.mode);

  // Handle status updates
  const handleStatusUpdate = useCallback(
    (status: SessionStatus) => {
      console.log("ACP: Status update received:", status);
      setStatus(status);
    },
    [setStatus]
  );

  /**
   * Update or create a streaming entry (message or thought)
   * Simple approach: check last entry, append if matching type, otherwise create new
   */
  const handleStreamingChunk = useCallback(
    (sessionId: string, text: string, entryType: "message" | "thought") => {
      const state = useAgentStore.getState();
      const session = state.sessions[sessionId];
      if (!session) {
        console.warn("ACP: No session found for streaming chunk:", sessionId);
        return;
      }

      const entries = session.entries;
      const lastEntry = getLastEntryIfType(entries, entryType);

      // Check if we should append to existing entry or create new
      if (lastEntry && ((entryType === "message" && isMessageEntry(lastEntry) && lastEntry.role === "assistant") ||
                        (entryType === "thought" && isThoughtEntry(lastEntry)))) {
        // Check for duplicate/cumulative chunk
        const newContent = extractNewContent(lastEntry.content, text);

        if (newContent === null) {
          // Duplicate chunk, skip
          return;
        }

        // Append new content to existing entry
        const updatedContent = lastEntry.content + newContent;
        const updatedEntry = { ...lastEntry, content: updatedContent };
        const updatedEntries = [...entries];
        const entryIndex = entries.findIndex(e => e.id === lastEntry.id);
        if (entryIndex !== -1) {
          updatedEntries[entryIndex] = updatedEntry;
          useAgentStore.setState({
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, entries: updatedEntries },
            },
          });
        }
      } else {
        // Create new entry
        if (entryType === "message") {
          const entry: MessageEntry = {
            id: Date.now(),
            sessionId,
            type: "message",
            role: "assistant",
            content: text,
            createdAt: Date.now(),
          };
          addEntry(sessionId, entry);
        } else {
          const entry: ThoughtEntry = {
            id: Date.now(),
            sessionId,
            type: "thought",
            content: text,
            createdAt: Date.now(),
          };
          addEntry(sessionId, entry);
        }
      }
    },
    [addEntry]
  );

  // Handle session notifications (messages, tool calls, etc.)
  // IMPORTANT: This follows the same logic as backend process.rs
  // See "Entry Processing Rules" in plan document
  const handleSessionUpdate = useCallback(
    (payload: SessionNotificationPayload) => {
      // SDK uses camelCase, handle both just in case
      const sessionId = payload.sessionId || payload.session_id;
      if (!sessionId) {
        console.log("ACP session update missing sessionId:", payload);
        return;
      }

      const update = payload.update;
      if (!update) {
        console.log("ACP session update (no update field):", payload);
        return;
      }

      const eventType = update.sessionUpdate;
      console.log("ACP session update:", eventType);

      switch (eventType) {
        // RULE 1: Message Chunk Handling
        case "agent_message_chunk": {
          const text = update.content?.text || "";
          if (text) {
            handleStreamingChunk(sessionId, text, "message");
          }
          break;
        }

        // RULE 2: Message End Detection (explicit event, may not be sent)
        case "agent_message_end": {
          // Nothing special to do - content is already in the entry
          console.log("ACP: agent_message_end received");
          break;
        }

        // RULE 9: Thought Chunk Handling
        case "agent_thought_chunk": {
          const text = update.content?.text || "";
          if (text) {
            handleStreamingChunk(sessionId, text, "thought");
          }
          break;
        }

        // RULE 3: Tool Call Creation
        case "tool_call": {
          console.log("ACP tool_call:", JSON.stringify(update));

          // Get the clean tool name from metadata
          const rawToolName = update._meta?.claudeCode?.toolName || update.toolCallId || "Tool";
          const toolName = cleanToolName(rawToolName);

          if (update.toolCallId) {
            const entry: ToolCallEntry = {
              id: Date.now(), // Temporary ID
              sessionId,
              type: "tool_call",
              toolCallId: update.toolCallId,
              toolName,
              status: mapToolStatus(update.status),
              title: update.title || toolName,
              kind: mapToolKind(update.kind),
              rawInput: update.rawInput,
              createdAt: Date.now(),
            };
            addEntry(sessionId, entry);
            console.log("ACP: Added tool call entry:", toolName);
          }
          break;
        }

        // RULE 4: Tool Call Update
        case "tool_call_update": {
          console.log("ACP tool_call_update:", JSON.stringify(update));

          if (update.toolCallId) {
            updateEntryByToolCallId(sessionId, update.toolCallId, {
              status: mapToolStatus(update.status),
              // Content would come from the update if small enough
            });
            console.log("ACP: Updated tool call:", update.toolCallId, "status:", update.status);
          }
          break;
        }

        // RULE 10: Plan Update
        case "plan": {
          console.log("ACP plan:", JSON.stringify(update));

          // Parse plan entries from the SDK payload
          const planData = update.plan as { entries?: Array<{ content: string; priority: string; status: string }> } | undefined;
          if (planData?.entries) {
            const planItems: PlanItem[] = planData.entries.map((e) => ({
              content: e.content,
              priority: (e.priority?.toLowerCase() || "medium") as "high" | "medium" | "low",
              status: (e.status?.toLowerCase().replace("_", "_") || "pending") as "pending" | "in_progress" | "completed",
            }));

            const entry: PlanEntry = {
              id: Date.now(),
              sessionId,
              type: "plan",
              entries: planItems,
              createdAt: Date.now(),
            };
            addEntry(sessionId, entry);
            console.log("ACP: Added plan entry with", planItems.length, "items");
          }
          break;
        }

        // RULE 12: Available Commands Update (stored in session state, not displayed)
        case "available_commands_update": {
          console.log("ACP available_commands_update:", JSON.stringify(update));
          // Commands are stored in session capabilities but not displayed as entries
          // The backend will update the meta entry with available_commands
          break;
        }

        // RULE 11: Mode Change
        case "current_mode_update": {
          console.log("ACP current_mode_update:", JSON.stringify(update));

          // Get current mode from capabilities or store
          const currentCapabilities = useAgentStore.getState().sessionCapabilities;
          const previousModeId = currentCapabilities?.currentModeId || "agent";
          const newModeId = (update as { currentModeId?: string }).currentModeId || "agent";

          // Only create entry if mode actually changed
          if (previousModeId !== newModeId) {
            const entry: ModeChangeEntry = {
              id: Date.now(),
              sessionId,
              type: "mode_change",
              previousModeId,
              newModeId,
              createdAt: Date.now(),
            };
            addEntry(sessionId, entry);
            console.log("ACP: Added mode change entry:", previousModeId, "->", newModeId);

            // Update the store's current mode
            if (currentCapabilities) {
              setSessionCapabilities({
                ...currentCapabilities,
                currentModeId: newModeId,
              });
            }
          }
          break;
        }

        case "error": {
          console.error("ACP session error:", update);
          setError(String(update) || "Unknown error");
          break;
        }

        default:
          console.log("ACP unknown session update:", update);
      }
    },
    [addEntry, updateEntryByToolCallId, handleStreamingChunk, setError]
  );

  // RULE 5: Handle permission requests
  const handlePermissionRequest = useCallback(
    (request: PermissionRequest) => {
      console.log("ACP: Permission request received:", request);

      // Create permission request entry in the current session
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (currentSessionId) {
        const entry: PermissionRequestEntry = {
          id: Date.now(),
          sessionId: currentSessionId,
          type: "permission_request",
          requestId: request.requestId,
          toolName: request.toolName,
          description: request.description,
          options: request.options,
          createdAt: Date.now(),
        };
        addEntry(currentSessionId, entry);
      }

      // Also set in store for dialog display
      setPendingPermission(request);
    },
    [setPendingPermission, addEntry]
  );

  // RULE 7: Handle session capabilities
  const handleSessionCapabilities = useCallback(
    (capabilities: SessionCapabilities) => {
      console.log("ACP: Session capabilities received:", capabilities);

      // Store in state for UI
      setSessionCapabilities(capabilities);

      // Create meta entry in the current session
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (currentSessionId) {
        const entry: MetaEntry = {
          id: Date.now(),
          sessionId: currentSessionId,
          type: "meta",
          availableModes: capabilities.availableModes,
          availableModels: capabilities.availableModels,
          currentModeId: capabilities.currentModeId,
          currentModelId: capabilities.currentModelId,
          createdAt: Date.now(),
        };
        addEntry(currentSessionId, entry);
      }
    },
    [setSessionCapabilities, addEntry]
  );

  // Handle message end signal from backend
  const handleMessageEnd = useCallback(
    (sessionId: string) => {
      console.log("ACP: Message end signal from backend for session:", sessionId);
      // Nothing special to do - content is already in the entry
    },
    []
  );

  // Handle errors
  const handleError = useCallback(
    (error: string) => {
      setError(error);
      setStatus("error");
      console.error("ACP error:", error);
    },
    [setError, setStatus]
  );

  // Set up event listeners
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Status updates
      const unlistenStatus = await listen<SessionStatus>(ACP_STATUS, (event) => {
        handleStatusUpdate(event.payload);
      });
      unlisteners.push(unlistenStatus);

      // Session updates
      const unlistenSession = await listen<SessionNotificationPayload>(
        ACP_SESSION_UPDATE,
        (event) => {
          handleSessionUpdate(event.payload);
        }
      );
      unlisteners.push(unlistenSession);

      // Permission requests
      const unlistenPermission = await listen<PermissionRequest>(
        ACP_PERMISSION_REQUEST,
        (event) => {
          handlePermissionRequest(event.payload);
        }
      );
      unlisteners.push(unlistenPermission);

      // Session capabilities (modes and models)
      const unlistenCapabilities = await listen<SessionCapabilities>(
        ACP_SESSION_CAPABILITIES,
        (event) => {
          handleSessionCapabilities(event.payload);
        }
      );
      unlisteners.push(unlistenCapabilities);

      // Message end signal
      const unlistenMessageEnd = await listen<string>(ACP_MESSAGE_END, (event) => {
        handleMessageEnd(event.payload);
      });
      unlisteners.push(unlistenMessageEnd);

      // Errors
      const unlistenError = await listen<string>(ACP_ERROR, (event) => {
        handleError(event.payload);
      });
      unlisteners.push(unlistenError);
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [handleStatusUpdate, handleSessionUpdate, handlePermissionRequest, handleSessionCapabilities, handleMessageEnd, handleError]);

  // Connection methods
  const connect = useCallback(async () => {
    if (!projectPath) return;
    try {
      console.log("ACP: Connecting to", projectPath);
      setStatus("connecting");
      await acpConnect(projectPath);
      console.log("ACP: Connected successfully");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("ACP: Connection failed:", errorMsg);
      setError(errorMsg);
      setStatus("error");
    }
  }, [projectPath, setStatus, setError]);

  const newSession = useCallback(
    async (name?: string) => {
      if (!projectPath) return null;
      try {
        console.log("ACP: Creating new session, mode:", mode);
        const sessionId = await acpNewSession(projectPath, mode);
        console.log("ACP: Session created with ID:", sessionId);

        // Create session in frontend store
        const session = createChatSession(sessionId, projectPath, name);
        storeCreateSession(session);
        return sessionId;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("ACP: Failed to create session:", errorMsg);
        setError(errorMsg);
        return null;
      }
    },
    [projectPath, mode, storeCreateSession, setError]
  );

  // Resume an existing session from the database
  const resumeSession = useCallback(
    async (sessionId: string) => {
      if (!projectPath) return null;
      try {
        console.log("ACP: Resuming session:", sessionId, "mode:", mode);
        const result = await acpResumeSession(projectPath, sessionId, mode);
        console.log("ACP: Session resumed:", result);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("ACP: Failed to resume session:", errorMsg);
        setError(errorMsg);
        return null;
      }
    },
    [projectPath, mode, setError]
  );

  // RULE 8: Send prompt (user message created by backend, but we also add to frontend)
  const sendPrompt = useCallback(
    async (sessionId: string, text: string) => {
      if (!projectPath) return;
      try {
        console.log("ACP: Sending prompt to session:", sessionId);

        // Add user message entry to frontend store
        const mentions = useAgentStore.getState().contextMentions;
        const userEntry = createUserMessageEntry(sessionId, text, mentions);
        addEntry(sessionId, userEntry);

        // Create content blocks for backend
        const content = createPromptContent(text, mentions);

        // Clear context mentions after sending
        useAgentStore.getState().clearContextMentions();

        // Send to backend
        await acpSendPrompt(projectPath, sessionId, content);
        console.log("ACP: Prompt sent successfully");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("ACP: Failed to send prompt:", errorMsg);
        setError(errorMsg);
      }
    },
    [projectPath, addEntry, setError]
  );

  const cancel = useCallback(
    async (sessionId: string) => {
      if (!projectPath) return;
      try {
        await acpCancel(projectPath, sessionId);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [projectPath, setError]
  );

  const setMode = useCallback(
    async (sessionId: string, newMode: typeof mode) => {
      if (!projectPath) return;
      try {
        await acpSetMode(projectPath, sessionId, newMode);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [projectPath, setError]
  );

  // RULE 6: Respond to permission request
  const respondToPermission = useCallback(
    async (requestId: string, selectedOption: string) => {
      console.log("ACP: respondToPermission called with requestId:", requestId, "selectedOption:", selectedOption);
      if (!projectPath) {
        console.error("ACP: respondToPermission failed - no projectPath");
        return;
      }
      try {
        console.log("ACP: Calling acpRespondPermission...");

        // Add timeout to detect if the invoke is hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("acpRespondPermission timed out after 10s")), 10000);
        });

        const result = await Promise.race([
          acpRespondPermission(projectPath, requestId, selectedOption),
          timeoutPromise
        ]);

        console.log("ACP: acpRespondPermission returned:", result);

        // Update the permission request entry with response
        const currentSessionId = useAgentStore.getState().currentSessionId;
        if (currentSessionId) {
          updateEntryByRequestId(currentSessionId, requestId, {
            responseOption: selectedOption,
            responseTime: Date.now(),
          });
        }

        console.log("ACP: Permission response sent, clearing pending permission");
        setPendingPermission(null);
      } catch (error) {
        console.error("ACP: Error responding to permission:", error);
        setError(error instanceof Error ? error.message : String(error));
        // Still clear the permission on error so user can retry
        setPendingPermission(null);
      }
    },
    [projectPath, setPendingPermission, updateEntryByRequestId, setError]
  );

  return {
    connect,
    newSession,
    resumeSession,
    sendPrompt,
    cancel,
    setMode,
    respondToPermission,
  };
}
