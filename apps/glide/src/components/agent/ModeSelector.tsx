/**
 * Mode Selector - Compact dropdown for selecting agent modes
 *
 * Uses dynamic modes from ACP session capabilities when available,
 * falls back to hardcoded Plan/Agent/Ask modes otherwise.
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useAgentStore } from "../../stores/agent";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { AgentMode, AcpSessionMode } from "../../types/acp";
import { AgentModeLabels, AgentModeDescriptions } from "../../types/acp";
import { useAcpEvents } from "../../hooks/useAcpEvents";

// Fallback modes when ACP capabilities aren't available
const FALLBACK_MODES: AgentMode[] = ["plan", "agent", "ask"];

export function ModeSelector() {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const mode = useAgentStore((s) => s.mode);
  const setStoreMode = useAgentStore((s) => s.setMode);
  const status = useAgentStore((s) => s.status);
  const sessionCapabilities = useAgentStore((s) => s.sessionCapabilities);
  const setSessionCapabilities = useAgentStore((s) => s.setSessionCapabilities);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);

  // Get the ACP setMode function that actually calls the backend
  const { setMode: acpSetMode } = useAcpEvents();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Disable mode changes while prompting
  const isDisabled = status === "prompting";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Use dynamic modes from capabilities, or fallback to hardcoded modes
  const modes = useMemo(() => {
    if (sessionCapabilities?.availableModes?.length) {
      return sessionCapabilities.availableModes;
    }
    // Convert fallback modes to AcpSessionMode format
    return FALLBACK_MODES.map((m) => ({
      id: m,
      name: AgentModeLabels[m],
      description: AgentModeDescriptions[m],
    }));
  }, [sessionCapabilities?.availableModes]);

  // Get current mode ID (may be from ACP or our local state)
  const currentModeId = sessionCapabilities?.currentModeId || mode;
  const currentMode = modes.find((m) => m.id === currentModeId) || modes[0];

  const handleModeChange = async (modeId: string) => {
    if (isDisabled) return;
    setIsOpen(false);

    // Update local store immediately for responsive UI
    setStoreMode(modeId as AgentMode);

    // Also update sessionCapabilities.currentModeId for UI display
    if (sessionCapabilities) {
      setSessionCapabilities({
        ...sessionCapabilities,
        currentModeId: modeId,
      });
    }

    // Call ACP backend to actually change the mode
    if (currentSessionId) {
      await acpSetMode(currentSessionId, modeId as AgentMode);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={cn(
          "flex items-center gap-0.5 text-xs transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isDark
            ? "text-neutral-400 hover:text-neutral-200"
            : "text-neutral-500 hover:text-neutral-700"
        )}
      >
        <span className="font-medium">{currentMode?.name || "Default"}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1 min-w-24 rounded shadow-lg border z-50 py-1",
            isDark
              ? "bg-neutral-800 border-white/10"
              : "bg-white border-black/10"
          )}
        >
          {modes.map((m: AcpSessionMode) => {
            const isActive = currentModeId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                title={m.description || m.name}
                className={cn(
                  "w-full px-2 py-1 text-xs text-left transition-colors",
                  isActive
                    ? isDark
                      ? "bg-white/10 text-white"
                      : "bg-black/5 text-neutral-900"
                    : isDark
                      ? "text-neutral-300 hover:bg-white/5"
                      : "text-neutral-600 hover:bg-black/5"
                )}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
