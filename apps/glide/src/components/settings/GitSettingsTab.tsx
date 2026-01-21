/**
 * Git Settings Tab
 *
 * Git integration settings: blame, code lens, gutter, refresh interval.
 */

import { GitBranch, Eye, Clock, Code } from "lucide-react";
import { cn } from "../../lib/utils";
import { useIdeSettingsStore, useDialogGitSettings } from "../../stores/settings";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import type { SettingsLevel } from "../../types/settings";
import { SettingSection, ToggleSetting, SelectInput } from "./GeneralSettingsTab";

interface GitSettingsTabProps {
  level: SettingsLevel;
}

export function GitSettingsTab({ level }: GitSettingsTabProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const gitSettings = useDialogGitSettings();
  const { updateSetting, loadSettingsForLevel, loadAllLevelSettings } = useIdeSettingsStore();

  const handleUpdate = async (key: string, value: unknown) => {
    await updateSetting(`git.${key}`, value, level);
    await loadSettingsForLevel(level);
    await loadAllLevelSettings();
  };

  return (
    <div className="space-y-6">
      {/* Inline Annotations */}
      <SettingSection
        title="Inline Annotations"
        description="Configure inline git annotations in the editor."
        icon={<Eye className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Line Blame"
            description="Show blame annotation at the end of the current line."
            checked={gitSettings.blame.enabled}
            onChange={(v) => handleUpdate("blame.enabled", v)}
          />

          <ToggleSetting
            label="Code Lens"
            description="Show commit information above functions and classes."
            checked={gitSettings.codeLens.enabled}
            onChange={(v) => handleUpdate("codeLens.enabled", v)}
          />
        </div>
      </SettingSection>

      {/* Gutter Decorations */}
      <SettingSection
        title="Gutter Decorations"
        description="Configure change indicators in the editor gutter."
        icon={<GitBranch className="w-4 h-4" />}
      >
        <ToggleSetting
          label="Gutter Indicators"
          description="Show colored indicators for added, modified, and deleted lines."
          checked={gitSettings.gutter.enabled}
          onChange={(v) => handleUpdate("gutter.enabled", v)}
        />
      </SettingSection>

      {/* Auto Refresh */}
      <SettingSection
        title="Auto Refresh"
        description="Configure automatic git status refresh."
        icon={<Clock className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Auto Refresh"
            description="Automatically refresh git status at regular intervals."
            checked={gitSettings.autoRefresh}
            onChange={(v) => handleUpdate("autoRefresh", v)}
          />

          {gitSettings.autoRefresh && (
            <div className="flex items-center gap-3 pl-3">
              <label
                className={cn(
                  "text-sm",
                  isDark ? "text-neutral-300" : "text-neutral-600"
                )}
              >
                Refresh Interval
              </label>
              <SelectInput
                value={String(gitSettings.refreshInterval)}
                onChange={(v) => handleUpdate("refreshInterval", Number(v))}
                options={[
                  { value: "10000", label: "10 seconds" },
                  { value: "30000", label: "30 seconds" },
                  { value: "60000", label: "1 minute" },
                  { value: "120000", label: "2 minutes" },
                  { value: "300000", label: "5 minutes" },
                ]}
              />
            </div>
          )}
        </div>
      </SettingSection>

      {/* Preview */}
      <div
        className={cn(
          "p-4 rounded-lg",
          isDark ? "bg-neutral-800/50" : "bg-neutral-100"
        )}
      >
        <h4
          className={cn(
            "text-sm font-medium mb-3",
            isDark ? "text-neutral-200" : "text-neutral-700"
          )}
        >
          Preview
        </h4>
        <div
          className={cn(
            "font-mono text-xs space-y-1",
            isDark ? "text-neutral-300" : "text-neutral-600"
          )}
        >
          {/* Simulated editor lines */}
          <div className="flex items-center gap-2">
            {gitSettings.gutter.enabled && (
              <span className="w-1 h-4 bg-green-500 rounded-sm" title="Added" />
            )}
            <span className="w-6 text-right text-neutral-500">12</span>
            <span>const greeting = "Hello";</span>
            {gitSettings.blame.enabled && (
              <span className="ml-auto text-neutral-500 text-[10px]">
                John Doe, 2 days ago
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {gitSettings.gutter.enabled && (
              <span className="w-1 h-4 bg-blue-500 rounded-sm" title="Modified" />
            )}
            <span className="w-6 text-right text-neutral-500">13</span>
            <span>const name = "World";</span>
          </div>
          {gitSettings.codeLens.enabled && (
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 py-1">
              <span className="w-1" />
              <span className="w-6" />
              <Code className="w-3 h-3" />
              <span>Last modified by John Doe, 2 days ago</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {gitSettings.gutter.enabled && <span className="w-1 h-4" />}
            <span className="w-6 text-right text-neutral-500">14</span>
            <span>function sayHello() {"{"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
