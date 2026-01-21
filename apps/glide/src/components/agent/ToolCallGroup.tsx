/**
 * Tool Call Group - Renders a collapsible group of consecutive tool calls
 *
 * Groups multiple tool calls into a single expandable card showing summary stats
 * like "Explored 10 files 4 searches" similar to Cursor's UI.
 */

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Terminal,
  Globe,
  Edit3,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { ToolCallEntry } from "../../types/acp";
import { ToolCallCard } from "./ToolCallCard";

interface ToolCallGroupProps {
  entries: ToolCallEntry[];
}

interface ToolStats {
  reads: number;
  searches: number;
  edits: number;
  commands: number;
  web: number;
  other: number;
}

/**
 * Categorize tool calls and count them
 */
function getToolStats(entries: ToolCallEntry[]): ToolStats {
  const stats: ToolStats = {
    reads: 0,
    searches: 0,
    edits: 0,
    commands: 0,
    web: 0,
    other: 0,
  };

  for (const entry of entries) {
    switch (entry.toolName) {
      case "Read":
        stats.reads++;
        break;
      case "Grep":
      case "Glob":
        stats.searches++;
        break;
      case "Write":
      case "Edit":
        stats.edits++;
        break;
      case "Bash":
        stats.commands++;
        break;
      case "WebFetch":
      case "WebSearch":
        stats.web++;
        break;
      default:
        stats.other++;
    }
  }

  return stats;
}

/**
 * Build summary text from stats
 */
function buildSummaryText(stats: ToolStats): string {
  const parts: string[] = [];

  if (stats.reads > 0) {
    parts.push(`${stats.reads} file${stats.reads > 1 ? "s" : ""}`);
  }
  if (stats.searches > 0) {
    parts.push(`${stats.searches} search${stats.searches > 1 ? "es" : ""}`);
  }
  if (stats.edits > 0) {
    parts.push(`${stats.edits} edit${stats.edits > 1 ? "s" : ""}`);
  }
  if (stats.commands > 0) {
    parts.push(`${stats.commands} command${stats.commands > 1 ? "s" : ""}`);
  }
  if (stats.web > 0) {
    parts.push(`${stats.web} web request${stats.web > 1 ? "s" : ""}`);
  }
  if (stats.other > 0) {
    parts.push(`${stats.other} other`);
  }

  return parts.join(" ");
}

/**
 * Determine the primary icon based on what's most common
 */
function getPrimaryIcon(stats: ToolStats) {
  const max = Math.max(
    stats.reads,
    stats.searches,
    stats.edits,
    stats.commands,
    stats.web,
    stats.other
  );

  if (stats.reads === max) return FileText;
  if (stats.searches === max) return Search;
  if (stats.edits === max) return Edit3;
  if (stats.commands === max) return Terminal;
  if (stats.web === max) return Globe;
  return FileText;
}

/**
 * Check if all entries are completed
 */
function getAllCompleted(entries: ToolCallEntry[]): boolean {
  return entries.every((e) => e.status === "completed");
}

/**
 * Check if any entry is in progress
 */
function getAnyInProgress(entries: ToolCallEntry[]): boolean {
  return entries.some((e) => e.status === "in_progress");
}

export function ToolCallGroup({ entries }: ToolCallGroupProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = getToolStats(entries);
  const summaryText = buildSummaryText(stats);
  const PrimaryIcon = getPrimaryIcon(stats);
  const allCompleted = getAllCompleted(entries);
  const anyInProgress = getAnyInProgress(entries);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      )}
    >
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
        )}
      >
        {/* Expand/collapse chevron */}
        {isExpanded ? (
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
        )}

        {/* Primary icon */}
        <PrimaryIcon
          className={cn(
            "w-4 h-4 shrink-0",
            allCompleted
              ? "text-green-500"
              : anyInProgress
                ? "text-blue-500"
                : "text-neutral-400"
          )}
        />

        {/* Summary text */}
        <span
          className={cn(
            "flex-1 text-xs",
            isDark ? "text-neutral-300" : "text-neutral-600"
          )}
        >
          Explored {summaryText}
        </span>

        {/* Status indicator */}
        {anyInProgress ? (
          <Loader2 className="w-4 h-4 shrink-0 text-blue-500 animate-spin" />
        ) : allCompleted ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
        ) : null}
      </button>

      {/* Expanded Content - list of tool calls */}
      {isExpanded && (
        <div
          className={cn(
            "border-t px-2 py-2 space-y-1.5",
            isDark ? "border-white/10" : "border-black/10"
          )}
        >
          {entries.map((entry) => (
            <ToolCallCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
