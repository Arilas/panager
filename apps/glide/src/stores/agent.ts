/**
 * Agent state store for ACP (Agent Client Protocol) integration
 *
 * Manages chat sessions, entries, and agent state using a unified entry architecture.
 *
 * IMPORTANT: This store implements the Entry Processing Rules.
 * The frontend (useAcpEvents.ts) MUST use the same logic as backend (process.rs).
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentMode,
  AgentPlan,
  ApprovalMode,
  ChatEntry,
  ChatSession,
  ContentBlock,
  ContextMention,
  MessageEntry,
  MetaEntry,
  PendingApproval,
  PermissionRequest,
  PermissionRequestEntry,
  SessionCapabilities,
  SessionStatus,
  TextBlock,
  ToolCallEntry,
} from "../types/acp";

interface AgentState {
  // Connection status (runtime only, not persisted)
  status: SessionStatus;
  error: string | null;

  // Sessions
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;

  // Current mode (derived from latest meta entry, but cached here)
  mode: AgentMode;

  // Plan/tasks
  currentPlan: AgentPlan | null;

  // Approvals
  pendingApprovals: PendingApproval[];
  approvalMode: ApprovalMode;

  // Input state
  inputValue: string;
  contextMentions: ContextMention[];

  // Permission requests (for dialog display)
  pendingPermission: PermissionRequest | null;

  // Session capabilities (from latest meta entry)
  sessionCapabilities: SessionCapabilities | null;

  // Actions - Connection
  setStatus: (status: SessionStatus) => void;
  setError: (error: string | null) => void;

  // Actions - Sessions
  setCurrentSessionId: (sessionId: string | null) => void;
  createSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteSession: (sessionId: string) => void;

  // Actions - Entries (unified)
  addEntry: (sessionId: string, entry: ChatEntry) => void;
  updateEntry: (sessionId: string, entryId: number, updates: Partial<ChatEntry>) => void;
  updateEntryByToolCallId: (sessionId: string, toolCallId: string, updates: Partial<ToolCallEntry>) => void;
  updateEntryByRequestId: (sessionId: string, requestId: string, updates: Partial<PermissionRequestEntry>) => void;

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

  // Actions - Capabilities
  setSessionCapabilities: (capabilities: SessionCapabilities | null) => void;

  // Actions - Reset
  reset: () => void;

  // Computed helpers
  getCurrentSession: () => ChatSession | null;
  getSessionEntries: (sessionId: string) => ChatEntry[];
  getLatestMeta: (sessionId: string) => MetaEntry | null;
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
  inputValue: "",
  contextMentions: [],
  pendingPermission: null,
  sessionCapabilities: null,
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

      // Entry actions (unified)
      addEntry: (sessionId, entry) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                entries: [...session.entries, entry],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateEntry: (sessionId, entryId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                entries: session.entries.map((e) =>
                  e.id === entryId ? { ...e, ...updates } as ChatEntry : e
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateEntryByToolCallId: (sessionId, toolCallId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                entries: session.entries.map((e) =>
                  e.type === "tool_call" && e.toolCallId === toolCallId
                    ? { ...e, ...updates }
                    : e
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateEntryByRequestId: (sessionId, requestId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                entries: session.entries.map((e) =>
                  e.type === "permission_request" && e.requestId === requestId
                    ? { ...e, ...updates }
                    : e
                ),
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

      // Capabilities actions
      setSessionCapabilities: (capabilities) => set({ sessionCapabilities: capabilities }),

      // Reset
      reset: () => set(initialState),

      // Computed helpers
      getCurrentSession: () => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return null;
        return sessions[currentSessionId] || null;
      },

      getSessionEntries: (sessionId) => {
        const { sessions } = get();
        return sessions[sessionId]?.entries || [];
      },

      getLatestMeta: (sessionId) => {
        const { sessions } = get();
        const session = sessions[sessionId];
        if (!session) return null;
        // Find the most recent meta entry
        const metaEntries = session.entries.filter(
          (e): e is MetaEntry => e.type === "meta"
        );
        return metaEntries[metaEntries.length - 1] || null;
      },
    }),
    {
      name: "panager-agent-store",
      // Only persist user preferences, NOT sessions (stored in backend SQLite)
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        approvalMode: state.approvalMode,
        mode: state.mode,
      }),
    }
  )
);

/**
 * Helper to create a user message entry from input
 * See "Entry Processing Rules" - RULE 8: User Message
 */
export function createUserMessageEntry(
  sessionId: string,
  text: string,
  _mentions: ContextMention[]
): MessageEntry {
  // For now, just create a simple message entry with text content
  // Context mentions could be expanded to resource entries if needed
  return {
    id: Date.now(), // Temporary ID for frontend (backend will assign real ID)
    sessionId,
    type: "message",
    role: "user",
    content: text,
    createdAt: Date.now(),
  };
}

/**
 * Helper to create a new chat session
 */
export function createChatSession(
  sessionId: string,
  projectPath: string,
  name?: string
): ChatSession {
  const timestamp = Date.now();
  return {
    id: sessionId, // ACP session ID (same as DB primary key)
    name: name || `Chat ${new Date(timestamp).toLocaleString()}`,
    entries: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    projectPath,
  };
}

/**
 * Generate a session name from the first user message.
 * Truncates to ~40 characters and adds ellipsis if needed.
 */
export function generateSessionName(message: string): string {
  // Clean up the message - remove extra whitespace, newlines
  const cleaned = message.trim().replace(/\s+/g, " ");

  // If empty, return default
  if (!cleaned) {
    return `Chat ${new Date().toLocaleString()}`;
  }

  // Truncate to ~40 chars at word boundary
  const maxLength = 40;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Find last space before maxLength
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + "...";
  }

  // No good word boundary, just truncate
  return truncated + "...";
}

/**
 * Helper to create ContentBlock array from text for sending prompts
 */
export function createPromptContent(
  text: string,
  mentions: ContextMention[]
): ContentBlock[] {
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

  return content;
}
