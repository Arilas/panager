/**
 * ACP Events Hook
 *
 * Listens to Tauri events from the ACP backend and updates the agent store.
 */

import { useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentStore, createChatSession } from "../stores/agent";
import { useIdeStore } from "../stores/ide";
import type {
  SessionStatus,
  PermissionRequest,
  ChatMessage,
  TextBlock,
} from "../types/acp";
import {
  acpConnect,
  acpNewSession,
  acpSendPrompt,
  acpSetMode,
  acpCancel,
  acpRespondPermission,
} from "../lib/tauri-acp";

// Event names matching the Rust backend
const ACP_STATUS = "acp:status";
const ACP_SESSION_UPDATE = "acp:session_update";
const ACP_PERMISSION_REQUEST = "acp:permission_request";
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
}

/**
 * Hook to manage ACP event subscriptions and provide connection methods
 */
export function useAcpEvents() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const projectPath = projectContext?.projectPath;

  // Agent store actions
  const setStatus = useAgentStore((s) => s.setStatus);
  const setError = useAgentStore((s) => s.setError);
  const setPendingPermission = useAgentStore((s) => s.setPendingPermission);
  const createSession = useAgentStore((s) => s.createSession);
  const addMessage = useAgentStore((s) => s.addMessage);
  const updateMessage = useAgentStore((s) => s.updateMessage);
  const startStreaming = useAgentStore((s) => s.startStreaming);
  const appendStreamingContent = useAgentStore((s) => s.appendStreamingContent);
  const finishStreaming = useAgentStore((s) => s.finishStreaming);
  const mode = useAgentStore((s) => s.mode);

  // Track current streaming message ID per session
  const streamingMessageIds = useRef<Map<string, string>>(new Map());

  // Handle status updates
  const handleStatusUpdate = useCallback(
    (status: SessionStatus) => {
      console.log("ACP: Status update received:", status);

      const currentStatus = useAgentStore.getState().status;
      const currentSessionId = useAgentStore.getState().currentSessionId;

      // When status changes to "prompting", clear any stale streaming state
      // This ensures each new prompt starts with a fresh assistant message
      if (status === "prompting" && currentSessionId) {
        const existingMessageId = streamingMessageIds.current.get(currentSessionId);
        if (existingMessageId) {
          console.log("ACP: Clearing stale streaming state for new prompt");
          finishStreaming();
          streamingMessageIds.current.delete(currentSessionId);
        }
      }

      // When status changes to "ready" after prompting, finalize any streaming message
      if (currentStatus === "prompting" && status === "ready" && currentSessionId) {
        // Check if we have a streaming message to finalize
        const messageId = streamingMessageIds.current.get(currentSessionId);
        if (messageId) {
          const streamingContent = useAgentStore.getState().streamingContent;
          console.log("ACP: Finalizing streaming on status change to ready, content:", streamingContent.length, "chars");

          // Update the message with final content
          updateMessage(currentSessionId, messageId, {
            content: [{ type: "text", text: streamingContent } as TextBlock],
          });

          // Clean up streaming state
          finishStreaming();
          streamingMessageIds.current.delete(currentSessionId);
        }
      }

      setStatus(status);
    },
    [setStatus, updateMessage, finishStreaming]
  );

  // Handle session notifications (messages, tool calls, etc.)
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

      console.log("ACP session update:", update.sessionUpdate);

      switch (update.sessionUpdate) {
        case "agent_message_chunk": {
          // Handle streaming text chunk
          // The SDK sends ContentChunk which has a content field containing ContentBlock
          // ContentBlock for text is { type: "text", text: "..." }
          const text = update.content?.text || "";

          // Check if we have a streaming message for this session
          let messageId = streamingMessageIds.current.get(sessionId);
          const currentStreamingId = useAgentStore.getState().streamingMessageId;

          // If we have a stale messageId (not currently streaming), clear it
          if (messageId && messageId !== currentStreamingId) {
            console.log("ACP: Clearing stale messageId, was:", messageId, "current streaming:", currentStreamingId);
            streamingMessageIds.current.delete(sessionId);
            messageId = undefined;
          }

          if (!messageId) {
            // Start a new assistant message
            messageId = crypto.randomUUID();
            streamingMessageIds.current.set(sessionId, messageId);
            console.log("ACP: Created streaming message:", messageId);

            // Create the assistant message in the store
            const assistantMessage: ChatMessage = {
              id: messageId,
              role: "assistant",
              content: [{ type: "text", text: "" } as TextBlock],
              timestamp: Date.now(),
            };
            addMessage(sessionId, assistantMessage);
            startStreaming(messageId);
          }

          // Append the chunk to streaming content
          if (text) {
            appendStreamingContent(text);
          }
          break;
        }

        case "agent_message_end": {
          // Message streaming complete (fallback, may not be sent by SDK)
          const messageId = streamingMessageIds.current.get(sessionId);
          if (messageId) {
            const streamingContent = useAgentStore.getState().streamingContent;
            console.log("ACP: agent_message_end - finalizing", streamingContent.length, "chars");

            updateMessage(sessionId, messageId, {
              content: [{ type: "text", text: streamingContent } as TextBlock],
            });

            finishStreaming();
            streamingMessageIds.current.delete(sessionId);
          }
          break;
        }

        case "agent_thought_chunk": {
          // Handle thinking/reasoning content (could show in UI)
          console.log("ACP agent_thought_chunk:", update.content?.text);
          // TODO: Show thinking content in UI
          break;
        }

        case "tool_call": {
          // Handle tool call start
          console.log("ACP tool_call:", JSON.stringify(update));
          // TODO: Add tool call to message
          break;
        }

        case "tool_call_update": {
          // Handle tool call result/update
          console.log("ACP tool_call_update:", JSON.stringify(update));
          // TODO: Update tool call with result
          break;
        }

        case "plan": {
          // Handle plan update
          console.log("ACP plan:", JSON.stringify(update));
          // TODO: Update plan in store
          break;
        }

        case "available_commands_update": {
          // Handle available commands update
          console.log("ACP available_commands_update:", JSON.stringify(update));
          break;
        }

        case "current_mode_update": {
          // Handle mode change
          console.log("ACP current_mode_update:", JSON.stringify(update));
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
    [addMessage, updateMessage, startStreaming, appendStreamingContent, finishStreaming, setError]
  );

  // Handle permission requests
  const handlePermissionRequest = useCallback(
    (request: PermissionRequest) => {
      setPendingPermission(request);
    },
    [setPendingPermission]
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
  }, [handleStatusUpdate, handleSessionUpdate, handlePermissionRequest, handleError]);

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
        const session = createChatSession(projectPath, mode, name);
        session.id = sessionId; // Use the ID from the backend
        createSession(session);
        return sessionId;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("ACP: Failed to create session:", errorMsg);
        setError(errorMsg);
        return null;
      }
    },
    [projectPath, mode, createSession, setError]
  );

  const sendPrompt = useCallback(
    async (sessionId: string, content: ChatMessage["content"]) => {
      if (!projectPath) return;
      try {
        console.log("ACP: Sending prompt to session:", sessionId);
        await acpSendPrompt(projectPath, sessionId, content);
        console.log("ACP: Prompt sent successfully");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("ACP: Failed to send prompt:", errorMsg);
        setError(errorMsg);
      }
    },
    [projectPath, setError]
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

  const respondToPermission = useCallback(
    async (requestId: string, selectedOption: string) => {
      if (!projectPath) return;
      try {
        await acpRespondPermission(projectPath, requestId, selectedOption);
        setPendingPermission(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [projectPath, setPendingPermission, setError]
  );

  return {
    connect,
    newSession,
    sendPrompt,
    cancel,
    setMode,
    respondToPermission,
  };
}
