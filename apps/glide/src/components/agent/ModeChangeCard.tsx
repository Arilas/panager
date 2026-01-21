/**
 * Mode Change Card - Renders a mode switch notification
 *
 * See: src/ide/docs/ENTRY_PROCESSING_RULES.md - RULE 11
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { ModeChangeEntry } from "../../types/acp";

interface ModeChangeCardProps {
  entry: ModeChangeEntry;
}

// Map mode IDs to display names
function getModeDisplayName(modeId: string): string {
  const modeNames: Record<string, string> = {
    agent: "Agent",
    plan: "Plan",
    code: "Code",
    default: "Default",
  };
  return modeNames[modeId] || modeId;
}

export function ModeChangeCard({ entry }: ModeChangeCardProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const fromMode = getModeDisplayName(entry.previousModeId);
  const toMode = getModeDisplayName(entry.newModeId);

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-2 text-xs",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <Sparkles className="w-3 h-3" />
      <span>Switched from</span>
      <span
        className={cn(
          "font-medium px-1.5 py-0.5 rounded",
          isDark ? "bg-white/10 text-neutral-300" : "bg-black/5 text-neutral-600"
        )}
      >
        {fromMode}
      </span>
      <ArrowRight className="w-3 h-3" />
      <span
        className={cn(
          "font-medium px-1.5 py-0.5 rounded",
          isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-500/10 text-purple-600"
        )}
      >
        {toMode}
      </span>
      <span>mode</span>
    </div>
  );
}
