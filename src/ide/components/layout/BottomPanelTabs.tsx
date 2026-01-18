/**
 * Bottom Panel Tabs - Tab bar for switching between Problems/Output/Terminal
 */

import { AlertCircle, Terminal, FileOutput } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useProblemsStore } from "../../stores/problems";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { BottomPanelTab } from "../../types";

interface TabItem {
  id: BottomPanelTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const TABS: TabItem[] = [
  { id: "problems", icon: AlertCircle, label: "Problems" },
  { id: "output", icon: FileOutput, label: "Output" },
  { id: "terminal", icon: Terminal, label: "Terminal" },
];

export function BottomPanelTabs() {
  const bottomPanelTab = useIdeStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useIdeStore((s) => s.setBottomPanelTab);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  return (
    <div className="flex items-center gap-1">
      {TABS.map(({ id, icon: Icon, label }) => {
        const isActive = bottomPanelTab === id;
        return (
          <button
            key={id}
            onClick={() => setBottomPanelTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
              "transition-colors",
              isActive
                ? isDark
                  ? "bg-white/10 text-white"
                  : "bg-black/10 text-neutral-900"
                : isDark
                  ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {id === "problems" && <ProblemsBadge />}
          </button>
        );
      })}
    </div>
  );
}

function ProblemsBadge() {
  const getSummary = useProblemsStore((s) => s.getSummary);

  const summary = getSummary();

  if (summary.total === 0) return null;

  const hasErrors = summary.errors > 0;
  const hasWarnings = summary.warnings > 0;

  return (
    <div className="flex items-center gap-1 ml-0.5">
      {hasErrors && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            "bg-red-500/20 text-red-500"
          )}
        >
          {summary.errors}
        </span>
      )}
      {hasWarnings && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
          )}
        >
          {summary.warnings}
        </span>
      )}
    </div>
  );
}
