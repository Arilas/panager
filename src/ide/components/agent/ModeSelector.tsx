/**
 * Mode Selector - Toggle between Plan, Agent, and Ask modes
 */

import { useAgentStore } from "../../stores/agent";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { AgentMode } from "../../types/acp";
import { AgentModeLabels, AgentModeDescriptions } from "../../types/acp";

const MODES: AgentMode[] = ["plan", "agent", "ask"];

export function ModeSelector() {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const status = useAgentStore((s) => s.status);

  // Disable mode changes while prompting
  const isDisabled = status === "prompting";

  return (
    <div className="flex items-center gap-1">
      {MODES.map((m) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            onClick={() => !isDisabled && setMode(m)}
            disabled={isDisabled}
            title={AgentModeDescriptions[m]}
            className={cn(
              "flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isActive
                ? [
                    isDark
                      ? "bg-white/15 text-white"
                      : "bg-black/10 text-neutral-900",
                  ]
                : [
                    isDark
                      ? "text-neutral-400 hover:text-white hover:bg-white/5"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5",
                  ]
            )}
          >
            {AgentModeLabels[m]}
          </button>
        );
      })}
    </div>
  );
}
