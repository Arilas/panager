/**
 * Thought Card - Renders an agent's internal reasoning as a collapsible card
 *
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md - RULE 9
 */

import { useState } from "react";
import { Brain, ChevronRight, ChevronDown } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { ThoughtEntry } from "../../types/acp";

interface ThoughtCardProps {
  entry: ThoughtEntry;
}

export function ThoughtCard({ entry }: ThoughtCardProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const [isExpanded, setIsExpanded] = useState(false);

  // Get a preview of the thought content
  const preview = entry.content.slice(0, 60) + (entry.content.length > 60 ? "..." : "");

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      )}
    >
      {/* Collapsed Header - clickable to expand */}
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

        {/* Brain icon */}
        <Brain
          className={cn(
            "w-4 h-4 shrink-0",
            isDark ? "text-purple-400" : "text-purple-500"
          )}
        />

        {/* Label */}
        <span
          className={cn(
            "font-medium shrink-0",
            isDark ? "text-purple-400" : "text-purple-600"
          )}
        >
          Thinking
        </span>

        {/* Preview - truncated (only when collapsed) */}
        {!isExpanded && (
          <span
            className={cn(
              "flex-1 truncate text-xs",
              isDark ? "text-neutral-400" : "text-neutral-500"
            )}
          >
            {preview}
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className={cn("border-t", isDark ? "border-white/10" : "border-black/10")}
        >
          <div className="p-3 max-h-64 overflow-y-auto">
            <pre
              className={cn(
                "text-xs whitespace-pre-wrap font-mono",
                isDark ? "text-neutral-300" : "text-neutral-600"
              )}
            >
              {entry.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
