/**
 * Agent state store for ACP (Agent Client Protocol) integration
 *
 * Manages chat sessions, messages, tool calls, and agent state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentMode,
  AgentPlan,
  ApprovalMode,
  ChatMessage,
  ChatSession,
  ContentBlock,
  ContextMention,
  PendingApproval,
  PermissionRequest,
  SessionStatus,
  TextBlock,
  ToolCall,
} from "../types/acp";

interface AgentState {
  // Connection status
  status: SessionStatus;
  error: string | null;

  // Sessions
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;

  // Current mode
  mode: AgentMode;

  // Plan/tasks
  currentPlan: AgentPlan | null;

  // Approvals
  pendingApprovals: PendingApproval[];
  approvalMode: ApprovalMode;

  // Streaming state
  streamingMessageId: string | null;
  streamingContent: string;
  streamingThoughts: string[];

  // Input state
  inputValue: string;
  contextMentions: ContextMention[];

  // Permission requests
  pendingPermission: PermissionRequest | null;

  // Actions - Connection
  setStatus: (status: SessionStatus) => void;
  setError: (error: string | null) => void;

  // Actions - Sessions
  setCurrentSessionId: (sessionId: string | null) => void;
  createSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteSession: (sessionId: string) => void;

  // Actions - Messages
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;

  // Actions - Streaming
  startStreaming: (messageId: string) => void;
  appendStreamingContent: (content: string) => void;
  appendStreamingThought: (thought: string) => void;
  finishStreaming: () => void;

  // Actions - Tool calls
  addToolCall: (sessionId: string, messageId: string, toolCall: ToolCall) => void;
  updateToolCall: (sessionId: string, messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;

  // Actions - Mode
  setMode: (mode: AgentMode) => void;

  // Actions - Plan
  setPlan: (plan: AgentPlan | null) => void;

  // Actions - Approvals
  addPendingApproval: (approval: PendingApproval) => void;
  updateApprovalStatus: (approvalId: string, status: PendingApproval["status"]) => void;
  removePendingApproval: (approvalId: string) => void;
  clearApprovals: () => void;
  setApprovalMode: (mode: ApprovalMode) => void;

  // Actions - Input
  setInputValue: (value: string) => void;
  addContextMention: (mention: ContextMention) => void;
  removeContextMention: (index: number) => void;
  clearContextMentions: () => void;

  // Actions - Permission
  setPendingPermission: (request: PermissionRequest | null) => void;

  // Actions - Reset
  reset: () => void;

  // Computed helpers
  getCurrentSession: () => ChatSession | null;
  getSessionMessages: (sessionId: string) => ChatMessage[];
}

const initialState = {
  status: "disconnected" as SessionStatus,
  error: null,
  currentSessionId: null,
  sessions: {},
  mode: "agent" as AgentMode,
  currentPlan: null,
  pendingApprovals: [],
  approvalMode: "per_change" as ApprovalMode,
  streamingMessageId: null,
  streamingContent: "",
  streamingThoughts: [],
  inputValue: "",
  contextMentions: [],
  pendingPermission: null,
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Connection actions
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),

      // Session actions
      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),

      createSession: (session) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [session.id]: session,
          },
          currentSessionId: session.id,
        })),

      updateSession: (sessionId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                ...updates,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      deleteSession: (sessionId) =>
        set((state) => {
          const { [sessionId]: _, ...rest } = state.sessions;
          return {
            sessions: rest,
            currentSessionId:
              state.currentSessionId === sessionId ? null : state.currentSessionId,
          };
        }),

      // Message actions
      addMessage: (sessionId, message) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: [...session.messages, message],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateMessage: (sessionId, messageId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      // Streaming actions
      startStreaming: (messageId) =>
        set({
          streamingMessageId: messageId,
          streamingContent: "",
          streamingThoughts: [],
        }),

      appendStreamingContent: (content) =>
        set((state) => ({
          streamingContent: state.streamingContent + content,
        })),

      appendStreamingThought: (thought) =>
        set((state) => ({
          streamingThoughts: [...state.streamingThoughts, thought],
        })),

      finishStreaming: () =>
        set({
          streamingMessageId: null,
          streamingContent: "",
          streamingThoughts: [],
        }),

      // Tool call actions
      addToolCall: (sessionId, messageId, toolCall) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((msg) => {
                  if (msg.id !== messageId) return msg;
                  return {
                    ...msg,
                    toolCalls: [...(msg.toolCalls || []), toolCall],
                  };
                }),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateToolCall: (sessionId, messageId, toolCallId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((msg) => {
                  if (msg.id !== messageId) return msg;
                  return {
                    ...msg,
                    toolCalls: (msg.toolCalls || []).map((tc) =>
                      tc.toolCallId === toolCallId ? { ...tc, ...updates } : tc
                    ),
                  };
                }),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      // Mode actions
      setMode: (mode) => set({ mode }),

      // Plan actions
      setPlan: (plan) => set({ currentPlan: plan }),

      // Approval actions
      addPendingApproval: (approval) =>
        set((state) => ({
          pendingApprovals: [...state.pendingApprovals, approval],
        })),

      updateApprovalStatus: (approvalId, status) =>
        set((state) => ({
          pendingApprovals: state.pendingApprovals.map((a) =>
            a.id === approvalId ? { ...a, status } : a
          ),
        })),

      removePendingApproval: (approvalId) =>
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter((a) => a.id !== approvalId),
        })),

      clearApprovals: () => set({ pendingApprovals: [] }),

      setApprovalMode: (mode) => set({ approvalMode: mode }),

      // Input actions
      setInputValue: (value) => set({ inputValue: value }),

      addContextMention: (mention) =>
        set((state) => ({
          contextMentions: [...state.contextMentions, mention],
        })),

      removeContextMention: (index) =>
        set((state) => ({
          contextMentions: state.contextMentions.filter((_, i) => i !== index),
        })),

      clearContextMentions: () => set({ contextMentions: [] }),

      // Permission actions
      setPendingPermission: (request) => set({ pendingPermission: request }),

      // Reset
      reset: () => set(initialState),

      // Computed helpers
      getCurrentSession: () => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return null;
        return sessions[currentSessionId] || null;
      },

      getSessionMessages: (sessionId) => {
        const { sessions } = get();
        return sessions[sessionId]?.messages || [];
      },
    }),
    {
      name: "panager-agent-store",
      // Only persist specific fields
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        approvalMode: state.approvalMode,
        mode: state.mode,
      }),
    }
  )
);

/**
 * Helper to create a user message from input
 */
export function createUserMessage(text: string, mentions: ContextMention[]): ChatMessage {
  const content: ContentBlock[] = [{ type: "text", text } as TextBlock];

  // Add context mentions as resource blocks
  for (const mention of mentions) {
    if (mention.type === "file") {
      content.push({
        type: "resource",
        resource: {
          uri: `file://${mention.path}`,
          name: mention.displayName,
        },
      });
    } else if (mention.type === "selection") {
      content.push({
        type: "resource",
        resource: {
          uri: `file://${mention.path}#L${mention.startLine}-L${mention.endLine}`,
          name: `Selection in ${mention.path}`,
          text: mention.content,
        },
      });
    } else if (mention.type === "folder") {
      content.push({
        type: "resource",
        resource: {
          uri: `file://${mention.path}`,
          name: mention.displayName,
        },
      });
    }
  }

  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    timestamp: Date.now(),
  };
}

/**
 * Helper to create a new chat session
 */
export function createChatSession(
  projectPath: string,
  mode: AgentMode = "agent",
  name?: string
): ChatSession {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  return {
    id,
    name: name || `Chat ${new Date(timestamp).toLocaleString()}`,
    mode,
    messages: [],
    status: "ready",
    createdAt: timestamp,
    updatedAt: timestamp,
    projectPath,
  };
}
