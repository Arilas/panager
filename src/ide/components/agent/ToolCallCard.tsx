/**
 * Tool Call Card - Renders a collapsible tool call entry
 */

import { useState } from "react";
import {
  FileText,
  Terminal,
  Diff,
  ChevronRight,
  ChevronDown,
  Globe,
  Search,
  Edit3,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { ToolCallEntry, ToolCallStatus } from "../../types/acp";

interface ToolCallCardProps {
  entry: ToolCallEntry;
}

/**
 * Get a summary for a tool call based on its type and input
 */
function getToolSummary(entry: ToolCallEntry): string {
  const input = entry.rawInput as Record<string, unknown> | undefined;

  switch (entry.toolName) {
    case "Read":
      return String(input?.file_path || input?.path || "file");
    case "Write":
    case "Edit":
      return String(input?.file_path || input?.path || "file");
    case "Bash": {
      const cmd = String(input?.command || "");
      return cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
    }
    case "Grep":
      return `"${input?.pattern || ""}"`;
    case "Glob":
      return String(input?.pattern || "");
    case "WebFetch":
      return String(input?.url || "");
    case "WebSearch":
      return String(input?.query || "");
    case "Task":
      return String(input?.description || entry.title || "");
    default:
      return entry.title || entry.toolName;
  }
}

/**
 * Get the appropriate icon for a tool
 */
function getToolIcon(entry: ToolCallEntry) {
  switch (entry.toolName) {
    case "Read":
      return FileText;
    case "Write":
    case "Edit":
      return Edit3;
    case "Bash":
      return Terminal;
    case "Grep":
    case "Glob":
      return Search;
    case "WebFetch":
    case "WebSearch":
      return Globe;
    default:
      // Fall back to kind-based icons
      if (entry.kind === "edit") return Diff;
      if (entry.kind === "execute") return Terminal;
      if (entry.kind === "fetch") return Globe;
      if (entry.kind === "search") return Search;
      return FileText;
  }
}

/**
 * Get the status icon for a tool call
 */
function getStatusIcon(status: ToolCallStatus) {
  switch (status) {
    case "pending":
      return null;
    case "in_progress":
      return Loader2;
    case "completed":
      return CheckCircle2;
    case "failed":
      return XCircle;
  }
}

export function ToolCallCard({ entry }: ToolCallCardProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const [isExpanded, setIsExpanded] = useState(false);

  const ToolIcon = getToolIcon(entry);
  const StatusIcon = getStatusIcon(entry.status);
  const summary = getToolSummary(entry);

  // Status colors
  const statusColors: Record<ToolCallStatus, string> = {
    pending: "text-neutral-400",
    in_progress: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  // Determine if there's expandable content (output from completed tools)
  const hasContent = entry.output !== undefined;

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      )}
    >
      {/* Collapsed Header - clickable to expand */}
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        disabled={!hasContent}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          hasContent && "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5",
          !hasContent && "cursor-default"
        )}
      >
        {/* Expand/collapse chevron */}
        {hasContent ? (
          isExpanded ? (
            <ChevronDown
              className={cn(
                "w-3 h-3 shrink-0",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}
            />
          ) : (
            <ChevronRight
              className={cn(
                "w-3 h-3 shrink-0",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}
            />
          )
        ) : (
          <span className="w-3" />
        )}

        {/* Tool icon */}
        <ToolIcon
          className={cn("w-4 h-4 shrink-0", statusColors[entry.status])}
        />

        {/* Tool name */}
        <span
          className={cn(
            "font-medium shrink-0",
            isDark ? "text-white" : "text-neutral-900"
          )}
        >
          {entry.toolName}
        </span>

        {/* Summary - truncated */}
        <span
          className={cn(
            "flex-1 truncate text-xs",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {summary}
        </span>

        {/* Status indicator */}
        {StatusIcon && (
          <StatusIcon
            className={cn(
              "w-4 h-4 shrink-0",
              statusColors[entry.status],
              entry.status === "in_progress" && "animate-spin"
            )}
          />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && hasContent && (
        <div
          className={cn("border-t", isDark ? "border-white/10" : "border-black/10")}
        >
          {/* Tool output */}
          <div className="p-3 max-h-48 overflow-y-auto">
            <pre
              className={cn(
                "text-xs whitespace-pre-wrap font-mono",
                isDark ? "text-neutral-300" : "text-neutral-600"
              )}
            >
              {typeof entry.output === "string"
                ? entry.output
                : JSON.stringify(entry.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
