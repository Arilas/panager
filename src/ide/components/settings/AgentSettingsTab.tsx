/**
 * Agent Settings Tab
 *
 * Settings for Claude Code integration: mode, approval workflow, etc.
 */

import { Bot, Shield, Eye, Zap } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useIdeSettingsStore, useDialogAgentSettings } from "../../stores/settings";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import type { SettingsLevel } from "../../types/settings";
import type { AgentMode, ApprovalMode } from "../../types/acp";
import { SettingSection, ToggleSetting } from "./GeneralSettingsTab";

interface AgentSettingsTabProps {
  level: SettingsLevel;
}

/** Labels for agent modes */
const AGENT_MODE_OPTIONS: { value: AgentMode; label: string; description: string }[] = [
  { value: "plan", label: "Plan", description: "Claude creates a plan before making changes" },
  { value: "agent", label: "Agent", description: "Claude autonomously makes changes" },
  { value: "ask", label: "Ask", description: "Claude answers questions without making changes" },
];

/** Labels for approval modes */
const APPROVAL_MODE_OPTIONS: { value: ApprovalMode; label: string; description: string }[] = [
  { value: "per_change", label: "Per Change", description: "Review each file change individually" },
  { value: "batch", label: "Batch", description: "Review all changes at once before applying" },
  { value: "auto", label: "Auto", description: "Automatically approve all changes" },
];

export function AgentSettingsTab({ level }: AgentSettingsTabProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const agentSettings = useDialogAgentSettings();
  const { updateSetting, loadSettingsForLevel, loadAllLevelSettings } = useIdeSettingsStore();

  const handleUpdate = async (key: string, value: unknown) => {
    await updateSetting(`agent.${key}`, value, level);
    await loadSettingsForLevel(level);
    await loadAllLevelSettings();
  };

  return (
    <div className="space-y-6">
      {/* Agent Mode */}
      <SettingSection
        title="Default Mode"
        description="Choose the default agent mode when starting a new chat session."
        icon={<Bot className="w-4 h-4" />}
      >
        <div className="space-y-2">
          {AGENT_MODE_OPTIONS.map((option) => (
            <ModeOption
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              selected={agentSettings.defaultMode === option.value}
              onSelect={() => handleUpdate("defaultMode", option.value)}
              isDark={isDark}
            />
          ))}
        </div>
      </SettingSection>

      {/* Approval Mode */}
      <SettingSection
        title="Approval Mode"
        description="How Claude Code handles file changes that require your approval."
        icon={<Shield className="w-4 h-4" />}
      >
        <div className="space-y-2">
          {APPROVAL_MODE_OPTIONS.map((option) => (
            <ModeOption
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              selected={agentSettings.approvalMode === option.value}
              onSelect={() => handleUpdate("approvalMode", option.value)}
              isDark={isDark}
            />
          ))}
        </div>
      </SettingSection>

      {/* Display Settings */}
      <SettingSection
        title="Display"
        description="Control what information is shown in the chat."
        icon={<Eye className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Show Agent Thoughts"
            description="Display the agent's reasoning and thought process in chat messages."
            checked={agentSettings.showThoughts}
            onChange={(v) => handleUpdate("showThoughts", v)}
          />
        </div>
      </SettingSection>

      {/* Connection Settings */}
      <SettingSection
        title="Connection"
        description="Configure how Claude Code connects to your project."
        icon={<Zap className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Auto-Connect"
            description="Automatically connect to Claude Code when opening a project."
            checked={agentSettings.autoConnect}
            onChange={(v) => handleUpdate("autoConnect", v)}
          />
        </div>
      </SettingSection>
    </div>
  );
}

interface ModeOptionProps {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  isDark: boolean;
}

function ModeOption({ label, description, selected, onSelect, isDark }: ModeOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
        "border",
        selected
          ? "border-primary bg-primary/5"
          : isDark
            ? "border-neutral-700 hover:border-neutral-600 hover:bg-white/5"
            : "border-neutral-200 hover:border-neutral-300 hover:bg-black/5"
      )}
    >
      {/* Radio indicator */}
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
          selected ? "border-primary" : isDark ? "border-neutral-500" : "border-neutral-400"
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium",
            isDark ? "text-neutral-200" : "text-neutral-700"
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "text-xs mt-0.5",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {description}
        </div>
      </div>
    </button>
  );
}
