/**
 * General Settings Tab
 *
 * Settings for activity bar position, default git view, appearance (Liquid Glass), and accent color.
 */

import { Layout, GitBranch, Droplet, Palette, Layers, Eye } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  useIdeSettingsStore,
  useDialogGeneralSettings,
} from "../../stores/settings";
import {
  useEffectiveTheme,
  isMacOS,
  useIsMacOS26Supported,
} from "../../hooks/useEffectiveTheme";
import type {
  SettingsLevel,
  ActivityBarPosition,
  GitViewMode,
  LiquidGlassMode,
  LiquidGlassIntensity,
} from "../../types/settings";
import { Button } from "../ui/Button";

/** Predefined accent colors */
const ACCENT_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Gray", value: "#6b7280" },
];

interface GeneralSettingsTabProps {
  level: SettingsLevel;
}

export function GeneralSettingsTab({ level }: GeneralSettingsTabProps) {
  const effectiveTheme = useEffectiveTheme();
  const macOS = isMacOS();
  const macOS26Supported = useIsMacOS26Supported();
  const isDark = effectiveTheme === "dark";
  // Use dialog settings which are merged up to the selected level
  const generalSettings = useDialogGeneralSettings();
  const {
    updateSetting,
    getOverrideLevel,
    loadSettingsForLevel,
    loadAllLevelSettings,
  } = useIdeSettingsStore();

  // Update setting - the store's updateSetting already handles reloading
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
  const activityBarOverride = getOverrideLevel(
    "general.activityBar.position",
    level,
  );
  const gitViewOverride = getOverrideLevel("general.git.defaultView", level);

  // Liquid Glass mode handlers
  const handleLiquidGlassMode = (mode: LiquidGlassMode) => {
    handleUpdate("general.appearance.liquidGlassMode", mode);
  };

  const handleLiquidGlassIntensity = (intensity: LiquidGlassIntensity) => {
    handleUpdate("general.appearance.liquidGlassIntensity", intensity);
  };

  // Accent color handlers
  const handleAccentColor = (color: string) => {
    handleUpdate("general.appearance.accentColor", color);
  };

  return (
    <div className="space-y-6">
      {/* Liquid Glass Section - only show on macOS */}
      {macOS && (
        <>
          {/* Liquid Glass Banner */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <Droplet className="h-4 w-4 text-blue-500" />
              <span className="text-[13px] font-medium">Liquid Glass</span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Apple's macOS-inspired translucent glass design with dynamic blur
              and light refraction effects.
            </p>
          </div>

          {/* Liquid Glass Mode */}
          <SettingSection
            title="Liquid Glass Effect"
            description="Enable glass morphism effects for panels and dialogs."
            icon={<Eye className="w-4 h-4" />}
          >
            <div className="flex gap-2">
              <OptionButton
                active={generalSettings.appearance.liquidGlassMode === false}
                onClick={() => handleLiquidGlassMode(false)}
                label="Off"
              />
              <OptionButton
                active={generalSettings.appearance.liquidGlassMode === "auto"}
                onClick={() => handleLiquidGlassMode("auto")}
                label={`Auto${macOS26Supported ? " (Active)" : ""}`}
              />
              <OptionButton
                active={generalSettings.appearance.liquidGlassMode === true}
                onClick={() => handleLiquidGlassMode(true)}
                label="On"
              />
            </div>
            {generalSettings.appearance.liquidGlassMode === "auto" && (
              <p
                className={cn(
                  "text-[11px] mt-2",
                  isDark ? "text-neutral-500" : "text-neutral-400",
                )}
              >
                Auto mode enables Liquid Glass only on macOS 26+ with native
                glass support.
                {macOS26Supported
                  ? " Your system supports native glass effects."
                  : " Native glass not detected on your system."}
              </p>
            )}
          </SettingSection>

          {/* Liquid Glass Intensity - only show when enabled */}
          {generalSettings.appearance.liquidGlassMode && (
            <SettingSection
              title="Effect Intensity"
              description="Control the strength of the blur and glass effects."
              icon={<Layers className="w-4 h-4" />}
            >
              <div className="flex gap-2">
                <IntensityButton
                  active={
                    generalSettings.appearance.liquidGlassIntensity === "subtle"
                  }
                  onClick={() => handleLiquidGlassIntensity("subtle")}
                  label="Subtle"
                  description="Light blur"
                />
                <IntensityButton
                  active={
                    generalSettings.appearance.liquidGlassIntensity === "medium"
                  }
                  onClick={() => handleLiquidGlassIntensity("medium")}
                  label="Medium"
                  description="Balanced"
                />
                <IntensityButton
                  active={
                    generalSettings.appearance.liquidGlassIntensity === "strong"
                  }
                  onClick={() => handleLiquidGlassIntensity("strong")}
                  label="Strong"
                  description="Heavy blur"
                />
              </div>
            </SettingSection>
          )}

          {/* Live Preview */}
          {generalSettings.appearance.liquidGlassMode && (
            <SettingSection
              title="Preview"
              description="See how the current settings look."
              icon={<Eye className="w-4 h-4" />}
            >
              <LiquidGlassPreview
                accentColor={generalSettings.appearance.accentColor}
              />
            </SettingSection>
          )}
        </>
      )}

      {/* Accent Color */}
      <SettingSection
        title="Accent Color"
        description="Choose the accent color used throughout the interface."
        icon={<Palette className="w-4 h-4" />}
      >
        <div className="space-y-3">
          {/* Color palette */}
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleAccentColor(color.value)}
                title={color.name}
                className={cn(
                  "w-8 h-8 rounded-lg transition-all",
                  "ring-offset-2 ring-offset-background",
                  generalSettings.appearance.accentColor === color.value
                    ? "ring-2 ring-primary scale-110"
                    : "hover:scale-105",
                )}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-2">
            <label
              className={cn(
                "text-xs",
                isDark ? "text-neutral-400" : "text-neutral-500",
              )}
            >
              Custom:
            </label>
            <input
              type="color"
              value={generalSettings.appearance.accentColor}
              onChange={(e) => handleAccentColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={generalSettings.appearance.accentColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  handleAccentColor(value);
                }
              }}
              placeholder="#3b82f6"
              className={cn(
                "w-24 px-2 py-1 rounded text-xs font-mono",
                "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                isDark
                  ? "bg-neutral-800 border-neutral-700 text-neutral-200"
                  : "bg-white border-neutral-200 text-neutral-700",
              )}
            />
          </div>
        </div>
      </SettingSection>

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
          isDark ? "bg-neutral-800/50" : "bg-neutral-100",
        )}
      >
        <p className={isDark ? "text-neutral-400" : "text-neutral-500"}>
          All settings are saved to{" "}
          <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">
            {level}
          </code>{" "}
          level in your settings file.
        </p>
      </div>
    </div>
  );
}

// Intensity button component
interface IntensityButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}

function IntensityButton({
  active,
  onClick,
  label,
  description,
}: IntensityButtonProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-lg",
        "text-[12px] transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : isDark
            ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700",
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "text-[10px]",
          active
            ? "text-primary-foreground/70"
            : isDark
              ? "text-neutral-500"
              : "text-neutral-400",
        )}
      >
        {description}
      </span>
    </button>
  );
}

// Liquid Glass preview component
interface LiquidGlassPreviewProps {
  accentColor: string;
}

function LiquidGlassPreview({ accentColor }: LiquidGlassPreviewProps) {
  return (
    <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 overflow-hidden">
      {/* Background pattern for demo */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-blue-500" />
        <div className="absolute top-6 right-4 w-12 h-12 rounded-full bg-purple-500" />
        <div className="absolute bottom-4 left-8 w-6 h-6 rounded-full bg-pink-500" />
        <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-cyan-500" />
      </div>

      {/* Demo Glass Cards */}
      <div className="relative space-y-3">
        {/* Demo Card */}
        <div className="liquid-glass-card-scope p-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-[12px] font-medium">Glass Card</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This card demonstrates the Liquid Glass effect with your accent
            color.
          </p>
        </div>

        {/* Demo Buttons Row */}
        <div className="flex gap-2">
          <Button variant="glass" className="flex-1">
            Glass Button
          </Button>
          <Button variant="glass-scope" className="flex-1">
            Accent Button
          </Button>
        </div>
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

export function SettingSection({
  title,
  description,
  icon,
  children,
  overrideLevel,
}: SettingSectionProps) {
  const effectiveTheme = useEffectiveTheme();
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
            isDark ? "text-neutral-200" : "text-neutral-700",
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
                : "bg-amber-100 text-amber-700",
            )}
          >
            Modified in {overrideLevel}
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-xs mb-3",
          isDark ? "text-neutral-500" : "text-neutral-400",
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

export function OptionButton({
  active,
  onClick,
  label,
  disabled,
}: OptionButtonProps) {
  const effectiveTheme = useEffectiveTheme();
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
            : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700",
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

export function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleSettingProps) {
  const effectiveTheme = useEffectiveTheme();
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
            : "bg-neutral-100/50 border border-neutral-200 hover:bg-neutral-100",
      )}
    >
      <ToggleSwitch checked={checked && !disabled} />
      <div>
        <div
          className={cn(
            "text-sm font-medium",
            isDark ? "text-neutral-200" : "text-neutral-700",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "text-xs mt-0.5",
            isDark ? "text-neutral-500" : "text-neutral-400",
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
        checked ? "bg-primary" : "bg-black/20 dark:bg-white/20",
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
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

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: NumberInputProps) {
  const effectiveTheme = useEffectiveTheme();
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
          : "bg-white border-neutral-200 text-neutral-700",
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

export function SelectInput({
  value,
  onChange,
  options,
  disabled,
}: SelectInputProps) {
  const effectiveTheme = useEffectiveTheme();
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
          : "bg-white border-neutral-200 text-neutral-700",
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
