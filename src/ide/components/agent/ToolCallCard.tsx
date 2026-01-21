/**
 * Tool Call Card - Renders a collapsible tool call entry
 *
 * Special handling for important tools:
 * - Task: Shows markdown output from sub-agents
 * - Bash: Shows terminal command and output
 * - ExitPlanMode: Shows plan content in markdown (expanded by default)
 * - Write/Edit: Shows file diffs
 */

import { useState } from "react";
import {
  FileText,
  Terminal,
  ChevronRight,
  ChevronDown,
  Globe,
  Search,
  Edit3,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
  FileCheck,
} from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type {
  ToolCallEntry,
  ToolCallStatus,
  ToolCallContentItem,
} from "../../types/acp";
import { MarkdownContent } from "./MarkdownContent";

interface ToolCallCardProps {
  entry: ToolCallEntry;
}

/**
 * Tools that should be expanded by default (important content to show)
 */
const EXPANDED_BY_DEFAULT = new Set(["ExitPlanMode", "Task"]);

/**
 * Tools that contain markdown content
 */
const MARKDOWN_TOOLS = new Set(["Task", "ExitPlanMode"]);

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
      return cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
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
    case "ExitPlanMode":
      return entry.title || "Ready to code?";
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
      return FileCheck;
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
    case "Task":
      return Bot;
    case "ExitPlanMode":
      return FileCheck;
    default:
      // Fall back to kind-based icons
      if (entry.kind === "edit") return Edit3;
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

/**
 * Render a diff content item with syntax highlighting
 * Handles both edits (oldText + newText) and new file creation (null oldText)
 */
function DiffContent({
  item,
  isDark,
}: {
  item: ToolCallContentItem;
  isDark: boolean;
}) {
  if (item.type !== "diff") {
    return null;
  }

  // Handle case where there's no actual content
  if (!item.newText && !item.oldText) {
    return null;
  }

  // Split into lines, handling null oldText for new file creation
  const oldLines = item.oldText ? item.oldText.split("\n") : [];
  const newLines = item.newText ? item.newText.split("\n") : [];

  // Check if this is a new file (no old content)
  const isNewFile = !item.oldText && item.newText;

  return (
    <div className="space-y-1">
      {item.path && (
        <div
          className={cn(
            "text-xs font-medium mb-2",
            isDark ? "text-neutral-400" : "text-neutral-500",
          )}
        >
          {isNewFile ? "New file: " : ""}{item.path}
        </div>
      )}
      <div
        className={cn(
          "font-mono text-xs rounded overflow-hidden max-h-60 overflow-y-auto",
          isDark ? "bg-black/30" : "bg-black/5",
        )}
      >
        {oldLines.map((line, i) => (
          <div
            key={`old-${i}`}
            className={cn(
              "px-2 py-0.5",
              isDark ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-700",
            )}
          >
            - {line}
          </div>
        ))}
        {newLines.map((line, i) => (
          <div
            key={`new-${i}`}
            className={cn(
              "px-2 py-0.5",
              isDark
                ? "bg-green-900/30 text-green-300"
                : "bg-green-50 text-green-700",
            )}
          >
            + {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Extract text content from various content item formats
 */
function getTextFromContentItem(item: ToolCallContentItem): string | null {
  if (item.type === "text" && item.text) {
    return item.text;
  }
  if (item.type === "content" && item.content?.text) {
    return item.content.text;
  }
  return null;
}

/**
 * Extract markdown content from tool for display
 * - Task: content comes from content array or output
 * - ExitPlanMode: plan content is in rawInput.plan
 */
function getMarkdownContent(entry: ToolCallEntry): string | null {
  const input = entry.rawInput as Record<string, unknown> | undefined;

  // ExitPlanMode stores plan in rawInput.plan
  if (entry.toolName === "ExitPlanMode" && input?.plan) {
    return String(input.plan);
  }

  // Task output comes from content array
  if (entry.toolName === "Task" && entry.content) {
    for (const item of entry.content) {
      const text = getTextFromContentItem(item);
      if (text) return text;
    }
  }

  // Also check output field
  if (entry.output && typeof entry.output === "string") {
    return entry.output;
  }

  return null;
}

export function ToolCallCard({ entry }: ToolCallCardProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  // Important tools start expanded
  const defaultExpanded = EXPANDED_BY_DEFAULT.has(entry.toolName);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const ToolIcon = getToolIcon(entry);
  const StatusIcon = getStatusIcon(entry.status);
  const summary = getToolSummary(entry);

  // Check if this is a markdown tool
  const isMarkdownTool = MARKDOWN_TOOLS.has(entry.toolName);
  const markdownContent = isMarkdownTool ? getMarkdownContent(entry) : null;

  // Status colors
  const statusColors: Record<ToolCallStatus, string> = {
    pending: "text-neutral-400",
    in_progress: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  // Determine if there's expandable content
  const hasContent =
    markdownContent !== null ||
    entry.output !== undefined ||
    (entry.content && entry.content.length > 0);

  // Separate diff items from text items (for non-markdown tools)
  const diffItems: ToolCallContentItem[] =
    entry.content?.filter((c) => c.type === "diff") ?? [];
  const textItems: ToolCallContentItem[] =
    entry.content?.filter((c) => c.type !== "diff") ?? [];

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
      )}
    >
      {/* Collapsed Header - clickable to expand */}
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        disabled={!hasContent}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          hasContent && "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5",
          !hasContent && "cursor-default",
        )}
      >
        {/* Expand/collapse chevron */}
        {hasContent ? (
          isExpanded ? (
            <ChevronDown
              className={cn(
                "w-3 h-3 shrink-0",
                isDark ? "text-neutral-500" : "text-neutral-400",
              )}
            />
          ) : (
            <ChevronRight
              className={cn(
                "w-3 h-3 shrink-0",
                isDark ? "text-neutral-500" : "text-neutral-400",
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
            isDark ? "text-white" : "text-neutral-900",
          )}
        >
          {entry.toolName}
        </span>

        {/* Summary - truncated */}
        <span
          className={cn(
            "flex-1 truncate text-xs",
            isDark ? "text-neutral-400" : "text-neutral-500",
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
              entry.status === "in_progress" && "animate-spin",
            )}
          />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && hasContent && (
        <div
          className={cn(
            "border-t",
            isDark ? "border-white/10" : "border-black/10",
          )}
        >
          <div className="p-3 max-h-96 overflow-y-auto space-y-3">
            {/* Markdown content for Task/ExitPlanMode */}
            {isMarkdownTool && markdownContent && (
              <MarkdownContent content={markdownContent} />
            )}

            {/* Regular content for other tools */}
            {!isMarkdownTool && (
              <>
                {/* Render diff content items */}
                {diffItems.map((item, i) => (
                  <DiffContent key={`diff-${i}`} item={item} isDark={isDark} />
                ))}

                {/* Render text content items */}
                {textItems.map((item, i) => {
                  const text = getTextFromContentItem(item);
                  return text ? (
                    <pre
                      key={`text-${i}`}
                      className={cn(
                        "text-xs whitespace-pre-wrap font-mono",
                        isDark ? "text-neutral-300" : "text-neutral-600",
                      )}
                    >
                      {text}
                    </pre>
                  ) : null;
                })}

                {/* Render legacy output field */}
                {!!entry.output && (
                  <pre
                    className={cn(
                      "text-xs whitespace-pre-wrap font-mono",
                      isDark ? "text-neutral-300" : "text-neutral-600",
                    )}
                  >
                    {typeof entry.output === "string"
                      ? entry.output
                      : JSON.stringify(entry.output, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
