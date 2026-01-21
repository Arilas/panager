/**
 * General Settings Tab
 *
 * Settings for activity bar position and default git view.
 */

import { Layout, GitBranch } from "lucide-react";
import { cn } from "../../lib/utils";
import { useIdeSettingsStore, useDialogGeneralSettings } from "../../stores/settings";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import type { SettingsLevel, ActivityBarPosition, GitViewMode } from "../../types/settings";

interface GeneralSettingsTabProps {
  level: SettingsLevel;
}

export function GeneralSettingsTab({ level }: GeneralSettingsTabProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  // Use dialog settings which are merged up to the selected level
  const generalSettings = useDialogGeneralSettings();
  const { updateSetting, getOverrideLevel, loadSettingsForLevel, loadAllLevelSettings } = useIdeSettingsStore();

  // Reload settings after update to reflect changes
  const handleUpdate = async (key: string, value: unknown) => {
    await updateSetting(key, value, level);
    await loadSettingsForLevel(level);
    await loadAllLevelSettings();
  };

  const handleActivityBarPosition = async (value: ActivityBarPosition) => {
    await handleUpdate("general.activityBar.position", value);
  };

  const handleGitDefaultView = async (value: GitViewMode) => {
    await handleUpdate("general.git.defaultView", value);
  };

  // Get override levels for each setting
  const activityBarOverride = getOverrideLevel("general.activityBar.position", level);
  const gitViewOverride = getOverrideLevel("general.git.defaultView", level);

  return (
    <div className="space-y-6">
      {/* Activity Bar Position */}
      <SettingSection
        title="Activity Bar Position"
        description="Controls where the activity bar (icons for panels) is displayed."
        icon={<Layout className="w-4 h-4" />}
        overrideLevel={activityBarOverride}
      >
        <div className="flex gap-2">
          <OptionButton
            active={generalSettings.activityBar.position === "left"}
            onClick={() => handleActivityBarPosition("left")}
            label="Left"
          />
          <OptionButton
            active={generalSettings.activityBar.position === "right"}
            onClick={() => handleActivityBarPosition("right")}
            label="Right"
          />
          <OptionButton
            active={generalSettings.activityBar.position === "hidden"}
            onClick={() => handleActivityBarPosition("hidden")}
            label="Hidden"
          />
        </div>
      </SettingSection>

      {/* Default Git View */}
      <SettingSection
        title="Default Git View"
        description="Controls the default view mode for git changes."
        icon={<GitBranch className="w-4 h-4" />}
        overrideLevel={gitViewOverride}
      >
        <div className="flex gap-2">
          <OptionButton
            active={generalSettings.git.defaultView === "tree"}
            onClick={() => handleGitDefaultView("tree")}
            label="Tree"
          />
          <OptionButton
            active={generalSettings.git.defaultView === "list"}
            onClick={() => handleGitDefaultView("list")}
            label="List"
          />
        </div>
      </SettingSection>

      {/* Info about levels */}
      <div
        className={cn(
          "p-3 rounded-lg text-xs",
          isDark ? "bg-neutral-800/50" : "bg-neutral-100"
        )}
      >
        <p className={isDark ? "text-neutral-400" : "text-neutral-500"}>
          Settings are saved to <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">{level}</code> level.
          Workspace settings override Scope, which override User settings.
        </p>
      </div>
    </div>
  );
}

// Reusable components

interface SettingSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** If set, shows a warning that this setting is modified at another level */
  overrideLevel?: SettingsLevel | null;
}

export function SettingSection({ title, description, icon, children, overrideLevel }: SettingSectionProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={isDark ? "text-neutral-400" : "text-neutral-500"}>
          {icon}
        </span>
        <h3
          className={cn(
            "text-sm font-medium",
            isDark ? "text-neutral-200" : "text-neutral-700"
          )}
        >
          {title}
        </h3>
        {overrideLevel && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              isDark
                ? "bg-amber-500/20 text-amber-400"
                : "bg-amber-100 text-amber-700"
            )}
          >
            Modified in {overrideLevel}
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-xs mb-3",
          isDark ? "text-neutral-500" : "text-neutral-400"
        )}
      >
        {description}
      </p>
      {children}
    </div>
  );
}

interface OptionButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

export function OptionButton({ active, onClick, label, disabled }: OptionButtonProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium",
        "transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        active
          ? "bg-primary text-primary-foreground"
          : isDark
          ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
      )}
    >
      {label}
    </button>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSetting({ label, description, checked, onChange, disabled }: ToggleSettingProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        checked && !disabled
          ? "bg-primary/10 border border-primary/20"
          : isDark
          ? "bg-neutral-800/50 border border-neutral-700 hover:bg-neutral-800"
          : "bg-neutral-100/50 border border-neutral-200 hover:bg-neutral-100"
      )}
    >
      <ToggleSwitch checked={checked && !disabled} />
      <div>
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
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        >
          {description}
        </div>
      </div>
    </button>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
}

function ToggleSwitch({ checked }: ToggleSwitchProps) {
  return (
    <div
      className={cn(
        "w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5",
        checked ? "bg-primary" : "bg-black/20 dark:bg-white/20"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, min, max, step = 1, disabled }: NumberInputProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "w-24 px-3 py-2 rounded-lg text-sm",
        "border focus:outline-none focus:ring-2 focus:ring-primary/30",
        disabled && "opacity-50 cursor-not-allowed",
        isDark
          ? "bg-neutral-800 border-neutral-700 text-neutral-200"
          : "bg-white border-neutral-200 text-neutral-700"
      )}
    />
  );
}

interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

export function SelectInput({ value, onChange, options, disabled }: SelectInputProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "px-3 py-2 rounded-lg text-sm",
        "border focus:outline-none focus:ring-2 focus:ring-primary/30",
        disabled && "opacity-50 cursor-not-allowed",
        isDark
          ? "bg-neutral-800 border-neutral-700 text-neutral-200"
          : "bg-white border-neutral-200 text-neutral-700"
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
