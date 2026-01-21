/**
 * Model Selector - Compact dropdown for selecting AI model
 *
 * Shows available models from ACP session capabilities.
 * Only visible when models are available from the ACP backend.
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useAgentStore } from "../../stores/agent";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { AcpSessionModel } from "../../types/acp";
import { useAcpEvents } from "../../hooks/useAcpEvents";

export function ModelSelector() {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const status = useAgentStore((s) => s.status);
  const sessionCapabilities = useAgentStore((s) => s.sessionCapabilities);
  const setSessionCapabilities = useAgentStore((s) => s.setSessionCapabilities);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);

  // Get the sendCommand function to send /model command
  const { sendCommand } = useAcpEvents();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Disable model changes while prompting
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

  // Get available models from capabilities
  const models = useMemo(() => {
    return sessionCapabilities?.availableModels || [];
  }, [sessionCapabilities?.availableModels]);

  // Get current model ID
  const currentModelId = sessionCapabilities?.currentModelId || "default";
  const currentModel = models.find((m) => m.modelId === currentModelId) || models[0];

  // Don't render if no models available
  if (!models.length) {
    return null;
  }

  const handleModelChange = async (modelId: string) => {
    if (isDisabled || !currentSessionId) return;
    setIsOpen(false);

    // Update sessionCapabilities.currentModelId for immediate UI feedback
    if (sessionCapabilities) {
      setSessionCapabilities({
        ...sessionCapabilities,
        currentModelId: modelId,
      });
    }

    // Send /model command to change the model
    await sendCommand(currentSessionId, `/model ${modelId}`);
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
        <span className="font-medium">{currentModel?.name || "Default"}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-1 min-w-24 rounded shadow-lg border z-50 py-1",
            isDark
              ? "bg-neutral-800 border-white/10"
              : "bg-white border-black/10"
          )}
        >
          {models.map((m: AcpSessionModel) => {
            const isActive = currentModelId === m.modelId;
            return (
              <button
                key={m.modelId}
                onClick={() => handleModelChange(m.modelId)}
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
