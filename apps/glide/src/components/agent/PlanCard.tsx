/**
 * Plan Card - Renders an agent's execution plan
 *
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md - RULE 10
 */

import { useState } from "react";
import { ListTodo, ChevronRight, ChevronDown, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { PlanEntry, PlanItem } from "../../types/acp";

interface PlanCardProps {
  entry: PlanEntry;
}

function PlanItemRow({ item, isDark }: { item: PlanItem; isDark: boolean }) {
  const statusIcon = {
    pending: <Circle className="w-3.5 h-3.5 text-neutral-400" />,
    in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  };

  const priorityColors = {
    high: isDark ? "text-red-400" : "text-red-500",
    medium: isDark ? "text-yellow-400" : "text-yellow-600",
    low: isDark ? "text-neutral-400" : "text-neutral-500",
  };

  return (
    <div className="flex items-start gap-2 py-1">
      <div className="shrink-0 mt-0.5">{statusIcon[item.status]}</div>
      <span
        className={cn(
          "flex-1 text-xs",
          item.status === "completed" && "line-through opacity-60",
          isDark ? "text-neutral-200" : "text-neutral-700"
        )}
      >
        {item.content}
      </span>
      {item.priority !== "medium" && (
        <span className={cn("text-[10px] uppercase shrink-0", priorityColors[item.priority])}>
          {item.priority}
        </span>
      )}
    </div>
  );
}

export function PlanCard({ entry }: PlanCardProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";
  const [isExpanded, setIsExpanded] = useState(true); // Plans default to expanded

  // Count status breakdown
  const completed = entry.entries.filter((e) => e.status === "completed").length;
  const total = entry.entries.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      )}
    >
      {/* Header */}
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

        {/* List icon */}
        <ListTodo
          className={cn(
            "w-4 h-4 shrink-0",
            isDark ? "text-blue-400" : "text-blue-500"
          )}
        />

        {/* Label */}
        <span
          className={cn(
            "font-medium shrink-0",
            isDark ? "text-blue-400" : "text-blue-600"
          )}
        >
          Plan
        </span>

        {/* Progress indicator */}
        <span
          className={cn(
            "text-xs",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {completed}/{total} ({progress}%)
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && entry.entries.length > 0 && (
        <div
          className={cn("border-t", isDark ? "border-white/10" : "border-black/10")}
        >
          <div className="p-3 space-y-1">
            {entry.entries.map((item, index) => (
              <PlanItemRow key={index} item={item} isDark={isDark} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
