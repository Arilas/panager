/**
 * Chat Tab Content - Full-screen chat interface for agent interaction
 *
 * Features:
 * - Centered input for new sessions (before first message)
 * - Header with session info, mode/model selectors, and plan progress
 * - Messages display with scrolling
 * - Input area at bottom after session starts
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { Send, StopCircle, Sparkles, Loader2 } from "lucide-react";
import { useAgentStore } from "../../stores/agent";
import { useIdeStore } from "../../stores/ide";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import { ModeSelector } from "./ModeSelector";
import { ModelSelector } from "./ModelSelector";
import { ChatMessage } from "./ChatMessage";
import { ApprovalBanner } from "./ApprovalBanner";
import { DiffApprovalCard } from "./DiffApprovalCard";
import { PermissionDialog } from "./PermissionDialog";
import { useAcpEvents } from "../../hooks/useAcpEvents";
import type { ChatEntry, ToolCallEntry, PlanEntry, PlanItem } from "../../types/acp";
import { isMessageEntry, isThoughtEntry, isToolCallEntry, isPermissionRequestEntry, isPlanEntry, isModeChangeEntry } from "../../types/acp";
import { ToolCallCard } from "./ToolCallCard";
import { ToolCallGroup } from "./ToolCallGroup";
import { ThoughtCard } from "./ThoughtCard";
import { PlanCard } from "./PlanCard";
import { ModeChangeCard } from "./ModeChangeCard";

/** A grouped item - either a single entry or a group of consecutive tool calls */
type GroupedEntry =
  | { type: "single"; entry: ChatEntry }
  | { type: "toolGroup"; entries: ToolCallEntry[] };

/**
 * Tools that should NEVER be grouped - they are important to see individually.
 * - Task: Sub-agent tasks with markdown output
 * - Bash: Command execution with terminal output
 * - Write: File writes/creates need to show content
 * - Edit: File edits need to show diffs
 * - ExitPlanMode: Contains plan content to review
 */
const UNGROUPED_TOOLS = new Set(["Task", "Bash", "Write", "Edit", "ExitPlanMode"]);

/**
 * Check if a tool call should be displayed individually (not grouped)
 */
function shouldDisplayUngrouped(entry: ToolCallEntry): boolean {
  return UNGROUPED_TOOLS.has(entry.toolName);
}

/**
 * Group consecutive tool calls together for collapsed display.
 * Important tools (Task, Bash, Write, Edit, ExitPlanMode) are NOT grouped.
 */
function groupConsecutiveToolCalls(entries: ChatEntry[]): GroupedEntry[] {
  const result: GroupedEntry[] = [];
  let currentToolGroup: ToolCallEntry[] = [];

  const flushToolGroup = () => {
    if (currentToolGroup.length === 0) return;

    if (currentToolGroup.length === 1) {
      result.push({ type: "single", entry: currentToolGroup[0] });
    } else {
      result.push({ type: "toolGroup", entries: [...currentToolGroup] });
    }
    currentToolGroup = [];
  };

  for (const entry of entries) {
    if (isToolCallEntry(entry)) {
      // Important tools should not be grouped
      if (shouldDisplayUngrouped(entry)) {
        flushToolGroup();
        result.push({ type: "single", entry });
      } else {
        currentToolGroup.push(entry);
      }
    } else {
      flushToolGroup();
      result.push({ type: "single", entry });
    }
  }

  flushToolGroup();
  return result;
}

/** Get the current in-progress task from a plan */
function getCurrentTask(plan: PlanEntry | null): PlanItem | null {
  if (!plan) return null;
  return plan.entries.find((item) => item.status === "in_progress") || null;
}

interface ChatTabContentProps {
  sessionId: string;
  sessionName: string;
}

export function ChatTabContent({ sessionId, sessionName }: ChatTabContentProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  // Agent store state
  const status = useAgentStore((s) => s.status);
  const sessions = useAgentStore((s) => s.sessions);
  const contextMentions = useAgentStore((s) => s.contextMentions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);

  // Agent store actions
  const setCurrentSessionId = useAgentStore((s) => s.setCurrentSessionId);

  // Pending approvals and permissions
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const pendingPermission = useAgentStore((s) => s.pendingPermission);

  // IDE store for project context
  const projectContext = useIdeStore((s) => s.projectContext);

  // ACP events and commands
  const { connect, sendPrompt, cancel, respondToPermission } = useAcpEvents();

  // Local state for tab-specific input
  const [tabInputValue, setTabInputValue] = useState("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get session from store
  const session = sessions[sessionId];
  const entries = session?.entries || [];

  // Filter entries for display
  const displayEntries = entries.filter(
    (e) => isMessageEntry(e) || isThoughtEntry(e) || isToolCallEntry(e) || isPermissionRequestEntry(e) || isPlanEntry(e) || isModeChangeEntry(e)
  );

  // Get the latest plan entry for progress display
  const latestPlan = entries
    .filter((e): e is PlanEntry => isPlanEntry(e))
    .pop() || null;
  const currentTask = getCurrentTask(latestPlan);

  // Auto-connect and set as current session when tab is shown
  useEffect(() => {
    if (projectContext?.projectPath && status === "disconnected") {
      connect();
    }
    // Set this session as current when tab becomes active
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSessionId(sessionId);
    }
  }, [projectContext?.projectPath, status, connect, sessionId, currentSessionId, setCurrentSessionId]);

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayEntries]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = useCallback(async () => {
    const messageText = tabInputValue.trim();
    if (!messageText) return;
    if (status === "prompting") return;
    if (status !== "ready") {
      console.warn("Cannot send message: ACP not ready, status:", status);
      return;
    }

    // Clear input
    setTabInputValue("");

    // Send prompt via ACP
    console.log("Sending prompt to session:", sessionId);
    await sendPrompt(sessionId, messageText);
  }, [tabInputValue, sessionId, status, sendPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancel = useCallback(async () => {
    await cancel(sessionId);
  }, [sessionId, cancel]);

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
  const canSend = tabInputValue.trim().length > 0 && isReady;

  // Group consecutive tool calls
  const groupedEntries = groupConsecutiveToolCalls(displayEntries);

  // Check if session has messages (to determine layout)
  const hasMessages = displayEntries.length > 0;

  // Render a single entry
  const renderSingleEntry = (entry: ChatEntry) => {
    if (isMessageEntry(entry)) {
      return <ChatMessage key={entry.id} entry={entry} isTab={true} />;
    }
    if (isThoughtEntry(entry)) {
      return <ThoughtCard key={entry.id} entry={entry} />;
    }
    if (isToolCallEntry(entry)) {
      return <ToolCallCard key={entry.id} entry={entry} />;
    }
    if (isPermissionRequestEntry(entry)) {
      if (entry.responseOption) {
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

  // Render grouped entry
  const renderGroupedEntry = (grouped: GroupedEntry, index: number) => {
    if (grouped.type === "single") {
      return renderSingleEntry(grouped.entry);
    }
    return <ToolCallGroup key={`group-${index}`} entries={grouped.entries} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with session info and plan progress */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("w-4 h-4", isDark ? "text-violet-400" : "text-violet-600")} />
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-neutral-900")}>
              {session?.name || sessionName}
            </span>
          </div>

          {/* Connection status */}
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              status === "ready" && "bg-green-500",
              status === "prompting" && "bg-green-500 animate-pulse",
              status === "connecting" && "bg-yellow-500 animate-pulse",
              status === "initializing" && "bg-yellow-500",
              status === "error" && "bg-red-500",
              status === "disconnected" && "bg-neutral-400"
            )}
            title={status}
          />

          {/* Current task in progress */}
          {currentTask && (
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md text-xs",
                isDark ? "bg-violet-500/10 text-violet-300" : "bg-violet-100 text-violet-700"
              )}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="truncate max-w-[300px]">{currentTask.content}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ModeSelector />
          <ModelSelector />
        </div>
      </div>

      {/* Approval banner */}
      {sessionApprovals.length > 0 && (
        <div className="px-4 py-2 border-b border-black/5 dark:border-white/5">
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

      {/* Content area */}
      {!hasMessages ? (
        /* Centered input for new session */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-6">
              <Sparkles
                className={cn(
                  "w-12 h-12 mx-auto mb-4",
                  isDark ? "text-violet-400" : "text-violet-600"
                )}
              />
              <h2
                className={cn(
                  "text-xl font-medium mb-2",
                  isDark ? "text-white" : "text-neutral-900"
                )}
              >
                Start a conversation with Claude
              </h2>
              <p className={cn("text-sm", isDark ? "text-neutral-400" : "text-neutral-500")}>
                Ask questions, get help with code, or request changes to your project
              </p>
            </div>

            {/* Centered input */}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={tabInputValue}
                onChange={(e) => setTabInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isReady
                    ? "Type a message to start..."
                    : status === "connecting"
                      ? "Connecting..."
                      : status === "error"
                        ? "Connection error"
                        : "Initializing..."
                }
                disabled={!isReady && !isPrompting}
                rows={3}
                className={cn(
                  "w-full resize-none rounded-lg px-4 py-3 pr-12",
                  "text-sm placeholder:text-neutral-400",
                  "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isDark
                    ? "bg-white/5 text-white border border-white/10"
                    : "bg-black/5 text-neutral-900 border border-black/10"
                )}
              />
              <button
                onClick={handleSendMessage}
                disabled={!canSend}
                className={cn(
                  "absolute right-3 bottom-3 p-2 rounded-md transition-colors",
                  canSend
                    ? "text-violet-500 hover:bg-violet-500/10"
                    : "text-neutral-400 cursor-not-allowed"
                )}
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Mode/Model selectors below input */}
            <div className="flex items-center justify-center gap-4 mt-3">
              <ModeSelector />
              <ModelSelector />
            </div>
          </div>
        </div>
      ) : (
        /* Messages area with bottom input */
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {groupedEntries.map(renderGroupedEntry)}

              {/* Pending approval cards */}
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
                    await respondToPermission(pendingPermission.requestId, optionId);
                  }}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom input area */}
          <div className="shrink-0 p-4 border-t border-black/5 dark:border-white/5">
            <div className="max-w-4xl mx-auto">
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
                      {mention.type === "selection" && "Selection"}
                      {mention.type === "symbol" && mention.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={tabInputValue}
                  onChange={(e) => setTabInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isReady
                      ? "Ask Claude Code..."
                      : status === "connecting"
                        ? "Connecting..."
                        : status === "error"
                          ? "Connection error"
                          : "Initializing..."
                  }
                  disabled={!isReady && !isPrompting}
                  rows={1}
                  className={cn(
                    "w-full resize-none rounded-lg px-4 py-3 pr-12",
                    "text-sm placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isDark
                      ? "bg-white/5 text-white border border-white/10"
                      : "bg-black/5 text-neutral-900 border border-black/10"
                  )}
                  style={{ minHeight: "48px", maxHeight: "200px" }}
                />

                {/* Send/Cancel button */}
                <button
                  onClick={isPrompting ? handleCancel : handleSendMessage}
                  disabled={!isPrompting && !canSend}
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md transition-colors",
                    isPrompting
                      ? "text-red-500 hover:bg-red-500/10"
                      : canSend
                        ? "text-violet-500 hover:bg-violet-500/10"
                        : "text-neutral-400 cursor-not-allowed"
                  )}
                  title={isPrompting ? "Cancel" : "Send"}
                >
                  {isPrompting ? (
                    <StopCircle className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
