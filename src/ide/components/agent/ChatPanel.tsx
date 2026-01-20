/**
 * Chat Panel - Main chat UI for agent interaction
 *
 * Displays chat entries (messages, tool calls, permission requests) with streaming support.
 * Uses the unified "entry" architecture - see "Entry Processing Rules" in plan document.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { Send, StopCircle, Plus, Settings2, ChevronDown, MessageSquare, Trash2 } from "lucide-react";
import { useAgentStore, createChatSession } from "../../stores/agent";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import { ModeSelector } from "./ModeSelector";
import { ModelSelector } from "./ModelSelector";
import { ChatMessage } from "./ChatMessage";
import { ApprovalBanner } from "./ApprovalBanner";
import { DiffApprovalCard } from "./DiffApprovalCard";
import { PermissionDialog } from "./PermissionDialog";
import { useAcpEvents } from "../../hooks/useAcpEvents";
import { acpListSessions, acpDeleteSession, acpLoadSession, type DbSessionInfo } from "../../lib/tauri-acp";
import type { ChatEntry } from "../../types/acp";
import { parseDbEntry, isMessageEntry, isThoughtEntry, isToolCallEntry, isPermissionRequestEntry, isMetaEntry, isPlanEntry, isModeChangeEntry } from "../../types/acp";
import { ToolCallCard } from "./ToolCallCard";
import { ThoughtCard } from "./ThoughtCard";
import { PlanCard } from "./PlanCard";
import { ModeChangeCard } from "./ModeChangeCard";

interface ChatPanelProps {
  /** Whether this panel is rendered in a tab (vs sidebar) */
  isTab?: boolean;
  /** Optional session ID to display (for tab mode) */
  sessionId?: string;
}

export function ChatPanel({ isTab: _isTab = false, sessionId }: ChatPanelProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  // Agent store state
  const status = useAgentStore((s) => s.status);
  const currentSessionId = sessionId || useAgentStore((s) => s.currentSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const inputValue = useAgentStore((s) => s.inputValue);
  const contextMentions = useAgentStore((s) => s.contextMentions);

  // Agent store actions
  const setInputValue = useAgentStore((s) => s.setInputValue);
  const setCurrentSessionId = useAgentStore((s) => s.setCurrentSessionId);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const storeCreateSession = useAgentStore((s) => s.createSession);
  const setSessionCapabilities = useAgentStore((s) => s.setSessionCapabilities);

  // Pending approvals and permissions
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const pendingPermission = useAgentStore((s) => s.pendingPermission);

  // IDE store for project context
  const projectContext = useIdeStore((s) => s.projectContext);

  // ACP events and commands
  const { connect, newSession, resumeSession, sendPrompt, cancel, respondToPermission } = useAcpEvents();

  // Local state
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [backendSessions, setBackendSessions] = useState<DbSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current session from store (for real-time updates)
  const session = currentSessionId ? sessions[currentSessionId] : null;
  const entries = session?.entries || [];

  // Filter entries for display (exclude meta entries)
  const displayEntries = entries.filter(
    (e) => isMessageEntry(e) || isThoughtEntry(e) || isToolCallEntry(e) || isPermissionRequestEntry(e) || isPlanEntry(e) || isModeChangeEntry(e)
  );

  // Fetch sessions from backend when dropdown opens
  const fetchBackendSessions = useCallback(async () => {
    if (!projectContext?.projectPath) return;
    setIsLoadingSessions(true);
    try {
      const sessions = await acpListSessions(projectContext.projectPath);
      setBackendSessions(sessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [projectContext?.projectPath]);

  // Auto-connect when panel is opened and we have a project path
  useEffect(() => {
    if (projectContext?.projectPath && status === "disconnected") {
      connect();
    }
  }, [projectContext?.projectPath, status, connect]);

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayEntries]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSessionDropdown(false);
      }
    };
    if (showSessionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSessionDropdown]);

  // Fetch sessions when dropdown opens
  useEffect(() => {
    if (showSessionDropdown) {
      fetchBackendSessions();
    }
  }, [showSessionDropdown, fetchBackendSessions]);

  const handleNewSession = useCallback(async () => {
    if (!projectContext?.projectPath) return;
    setShowSessionDropdown(false);
    // Create session via ACP backend (this also updates the store)
    await newSession();
  }, [projectContext?.projectPath, newSession]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (!projectContext?.projectPath) return;
    setCurrentSessionId(sessionId);
    setShowSessionDropdown(false);

    // Load session entries from backend if not already in store
    if (!sessions[sessionId]) {
      try {
        const loaded = await acpLoadSession(projectContext.projectPath, sessionId);
        if (loaded) {
          // Parse entries from DB format to store format
          const parsedEntries: ChatEntry[] = loaded.entries.map(parseDbEntry);

          // Create session in store with loaded entries
          const storeSession = createChatSession(
            loaded.session.id,
            projectContext.projectPath,
            loaded.session.name
          );
          storeSession.entries = parsedEntries;
          storeSession.createdAt = loaded.session.createdAt;
          storeSession.updatedAt = loaded.session.updatedAt;
          storeCreateSession(storeSession);

          // Set capabilities from latest meta entry
          const metaEntries = parsedEntries.filter(isMetaEntry);
          const latestMeta = metaEntries[metaEntries.length - 1];
          if (latestMeta) {
            setSessionCapabilities({
              availableModes: latestMeta.availableModes,
              availableModels: latestMeta.availableModels,
              currentModeId: latestMeta.currentModeId,
              currentModelId: latestMeta.currentModelId,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      }
    }

    // Resume the session in the ACP backend
    try {
      await resumeSession(sessionId);
    } catch (error) {
      console.error("Failed to resume session in ACP:", error);
    }
  }, [projectContext?.projectPath, setCurrentSessionId, sessions, storeCreateSession, setSessionCapabilities, resumeSession]);

  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!projectContext?.projectPath) return;

    try {
      // Delete from backend
      await acpDeleteSession(projectContext.projectPath, sessionId);
      // Delete from local store
      deleteSession(sessionId);
      // Refresh the list
      fetchBackendSessions();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }, [projectContext?.projectPath, deleteSession, fetchBackendSessions]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;
    if (status === "prompting") return;
    if (status !== "ready") {
      console.warn("Cannot send message: ACP not ready, status:", status);
      return;
    }

    let sessionIdToUse = currentSessionId;

    // Auto-create session if needed
    if (!sessionIdToUse) {
      console.log("Creating new session for first message...");
      sessionIdToUse = await newSession();
      if (!sessionIdToUse) {
        console.error("Failed to create session");
        return;
      }
    }

    // Clear input (user entry is added by sendPrompt)
    const messageText = inputValue.trim();
    setInputValue("");

    // Send prompt via ACP (this adds user entry and sends to backend)
    console.log("Sending prompt to session:", sessionIdToUse);
    await sendPrompt(sessionIdToUse, messageText);
  }, [
    inputValue,
    currentSessionId,
    status,
    setInputValue,
    sendPrompt,
    newSession,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancel = useCallback(async () => {
    if (!currentSessionId) return;
    await cancel(currentSessionId);
  }, [currentSessionId, cancel]);

  // Handle approval responses
  const handleApprovalResponse = useCallback(
    async (approvalId: string, approved: boolean) => {
      await respondToPermission(approvalId, approved ? "allow" : "deny");
    },
    [respondToPermission]
  );

  // Filter pending approvals for current session
  const sessionApprovals = pendingApprovals.filter(
    (a) => a.status === "pending"
  );

  const isReady = status === "ready";
  const isPrompting = status === "prompting";
  const canSend = inputValue.trim().length > 0 && isReady;

  // Render an entry based on its type
  const renderEntry = (entry: ChatEntry) => {
    if (isMessageEntry(entry)) {
      return (
        <ChatMessage
          key={entry.id}
          entry={entry}
        />
      );
    }

    if (isThoughtEntry(entry)) {
      return <ThoughtCard key={entry.id} entry={entry} />;
    }

    if (isToolCallEntry(entry)) {
      return <ToolCallCard key={entry.id} entry={entry} />;
    }

    if (isPermissionRequestEntry(entry)) {
      // Permission requests that are already answered are shown inline
      // Pending ones are shown via the pendingPermission dialog
      if (entry.responseOption) {
        // Show as answered permission request
        return (
          <div
            key={entry.id}
            className={cn(
              "text-xs px-3 py-2 rounded-lg",
              isDark ? "bg-white/5 text-neutral-400" : "bg-black/5 text-neutral-500"
            )}
          >
            Permission: {entry.toolName} - {entry.responseOption}
          </div>
        );
      }
      // Unanswered ones are handled by the dialog
      return null;
    }

    if (isPlanEntry(entry)) {
      return <PlanCard key={entry.id} entry={entry} />;
    }

    if (isModeChangeEntry(entry)) {
      return <ModeChangeCard key={entry.id} entry={entry} />;
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        {/* Session selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowSessionDropdown(!showSessionDropdown)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
              isDark
                ? "hover:bg-white/10"
                : "hover:bg-black/5"
            )}
          >
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-neutral-900")}>
              {session?.name || "Chat"}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5", isDark ? "text-neutral-400" : "text-neutral-500")} />
            {/* Connection status indicator */}
            <span
              className={cn(
                "w-2 h-2 rounded-full ml-1",
                status === "ready" && "bg-green-500",
                status === "prompting" && "bg-green-500 animate-pulse",
                status === "connecting" && "bg-yellow-500 animate-pulse",
                status === "initializing" && "bg-yellow-500",
                status === "error" && "bg-red-500",
                status === "disconnected" && "bg-neutral-400"
              )}
              title={status}
            />
          </button>

          {/* Dropdown menu */}
          {showSessionDropdown && (
            <div
              className={cn(
                "absolute left-0 top-full mt-1 w-64 rounded-lg shadow-lg border z-50",
                "max-h-80 overflow-y-auto",
                isDark
                  ? "bg-neutral-800 border-white/10"
                  : "bg-white border-black/10"
              )}
            >
              {/* New chat button */}
              <button
                onClick={handleNewSession}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                  "border-b",
                  isDark
                    ? "text-neutral-200 hover:bg-white/10 border-white/10"
                    : "text-neutral-700 hover:bg-black/5 border-black/10"
                )}
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>

              {/* Session list */}
              {isLoadingSessions ? (
                <div className={cn("px-3 py-4 text-sm text-center", isDark ? "text-neutral-500" : "text-neutral-400")}>
                  Loading...
                </div>
              ) : backendSessions.length === 0 ? (
                <div className={cn("px-3 py-4 text-sm text-center", isDark ? "text-neutral-500" : "text-neutral-400")}>
                  No chat history
                </div>
              ) : (
                backendSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors group",
                      s.id === currentSessionId
                        ? isDark
                          ? "bg-white/10 text-white"
                          : "bg-black/5 text-neutral-900"
                        : isDark
                          ? "text-neutral-300 hover:bg-white/5"
                          : "text-neutral-600 hover:bg-black/5"
                    )}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate">{s.name}</div>
                      <div className={cn("text-xs", isDark ? "text-neutral-500" : "text-neutral-400")}>
                        {s.entryCount} entries · {new Date(s.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className={cn(
                        "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                        isDark
                          ? "hover:bg-white/10 text-neutral-400 hover:text-red-400"
                          : "hover:bg-black/5 text-neutral-400 hover:text-red-500"
                      )}
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewSession}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/10"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
            )}
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/10"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
            )}
            title="Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Approval banner (shown when there are pending approvals) */}
      {sessionApprovals.length > 0 && (
        <div className="px-3 py-2 border-b border-black/5 dark:border-white/5">
          <ApprovalBanner
            onApproveAll={() => {
              sessionApprovals.forEach((a) => handleApprovalResponse(a.id, true));
            }}
            onRejectAll={() => {
              sessionApprovals.forEach((a) => handleApprovalResponse(a.id, false));
            }}
          />
        </div>
      )}

      {/* Entries area */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className={cn("text-sm", isDark ? "text-neutral-400" : "text-neutral-500")}>
              Start a conversation with Claude Code
            </p>
            <p className={cn("text-xs mt-1", isDark ? "text-neutral-500" : "text-neutral-400")}>
              Type a message below or use @file to add context
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayEntries.map(renderEntry)}

            {/* Pending approval cards (inline in chat) */}
            {sessionApprovals.map((approval) => (
              <DiffApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={(id) => handleApprovalResponse(id, true)}
                onReject={(id) => handleApprovalResponse(id, false)}
              />
            ))}

            {/* Permission request dialog */}
            {pendingPermission && (
              <PermissionDialog
                request={pendingPermission}
                onRespond={async (optionId) => {
                  console.log("ChatPanel: Permission response clicked - requestId=", pendingPermission.requestId, "optionId=", optionId);
                  try {
                    await respondToPermission(pendingPermission.requestId, optionId);
                    console.log("ChatPanel: respondToPermission completed successfully");
                  } catch (error) {
                    console.error("ChatPanel: respondToPermission failed:", error);
                  }
                }}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3 border-t border-black/5 dark:border-white/5">
        {/* Context mentions display */}
        {contextMentions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {contextMentions.map((mention, index) => (
              <span
                key={index}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                  isDark ? "bg-white/10 text-white" : "bg-black/5 text-neutral-700"
                )}
              >
                {mention.type === "file" && mention.displayName}
                {mention.type === "folder" && mention.displayName}
                {mention.type === "selection" && `Selection`}
                {mention.type === "symbol" && mention.name}
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isReady ? "Ask Claude Code..." : status === "connecting" ? "Connecting..." : status === "error" ? "Connection error" : "Initializing..."}
            disabled={!isReady && !isPrompting}
            rows={1}
            className={cn(
              "w-full resize-none rounded-lg px-3 py-2 pr-10",
              "text-sm placeholder:text-neutral-400",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isDark
                ? "bg-white/5 text-white border border-white/10"
                : "bg-black/5 text-neutral-900 border border-black/10"
            )}
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />

          {/* Send/Cancel button */}
          <button
            onClick={isPrompting ? handleCancel : handleSendMessage}
            disabled={!isPrompting && !canSend}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
              isPrompting
                ? "text-red-500 hover:bg-red-500/10"
                : canSend
                  ? "text-primary hover:bg-primary/10"
                  : "text-neutral-400 cursor-not-allowed"
            )}
            title={isPrompting ? "Cancel" : "Send"}
          >
            {isPrompting ? (
              <StopCircle className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          <ModeSelector />
          <ModelSelector />
        </div>
      </div>
    </div>
  );
}
