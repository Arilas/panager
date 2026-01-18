import { Droplet, Eye, Layers } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { Section, ToggleRow } from "../../common";
import { cn } from "../../../lib/utils";

export function AppearanceSettingsSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Liquid Glass Banner */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/20">
        <div className="flex items-center gap-2 mb-1">
          <Droplet className="h-4 w-4 text-blue-500" />
          <span className="text-[13px] font-medium">Liquid Glass</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Apple's macOS-inspired translucent glass design with dynamic blur and
          light refraction effects.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <Section title="Liquid Glass Effect" icon={<Eye className="h-4 w-4" />}>
        <ToggleRow
          label="Enable Liquid Glass"
          description="Apply glass morphism effects to dialogs, cards, sidebars, and the titlebar."
          checked={settings.liquid_glass_enabled}
          onChange={(checked) => updateSetting("liquid_glass_enabled", checked)}
        />
      </Section>

      {/* Intensity Setting */}
      <Section title="Effect Intensity" icon={<Layers className="h-4 w-4" />}>
        <p className="text-[12px] text-muted-foreground mb-3">
          Control the strength of the blur and glass effects.
        </p>
        <div className="flex gap-2">
          <IntensityButton
            active={settings.liquid_glass_intensity === "subtle"}
            onClick={() => updateSetting("liquid_glass_intensity", "subtle")}
            label="Subtle"
            description="Light blur"
            disabled={!settings.liquid_glass_enabled}
          />
          <IntensityButton
            active={settings.liquid_glass_intensity === "medium"}
            onClick={() => updateSetting("liquid_glass_intensity", "medium")}
            label="Medium"
            description="Balanced"
            disabled={!settings.liquid_glass_enabled}
          />
          <IntensityButton
            active={settings.liquid_glass_intensity === "strong"}
            onClick={() => updateSetting("liquid_glass_intensity", "strong")}
            label="Strong"
            description="Heavy blur"
            disabled={!settings.liquid_glass_enabled}
          />
        </div>
      </Section>

      {/* Live Demo */}
      <Section title="Preview" icon={<Eye className="h-4 w-4" />}>
        <LiquidGlassPreview enabled={settings.liquid_glass_enabled} />
      </Section>
    </div>
  );
}

interface IntensityButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  disabled?: boolean;
}

function IntensityButton({
  active,
  onClick,
  label,
  description,
  disabled,
}: IntensityButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-lg",
        "text-[12px] transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "text-[10px]",
          active ? "text-primary-foreground/70" : "text-muted-foreground"
        )}
      >
        {description}
      </span>
    </button>
  );
}

interface LiquidGlassPreviewProps {
  enabled: boolean;
}

function LiquidGlassPreview({ enabled }: LiquidGlassPreviewProps) {
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
        {/* Demo Card 1 */}
        <div
          className={cn(
            "p-3 transition-all",
            enabled
              ? "liquid-glass-card-scope"
              : "rounded-lg bg-white/60 dark:bg-neutral-900/60 border border-black/10 dark:border-white/10"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[12px] font-medium">Glass Card</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This card demonstrates the Liquid Glass effect with backdrop blur.
          </p>
        </div>

        {/* Demo Buttons Row */}
        <div className="flex gap-2">
          <button
            className={cn(
              "flex-1 px-3 py-2 text-[11px] font-medium transition-all rounded-lg",
              enabled
                ? "liquid-glass-button"
                : "bg-white/60 dark:bg-neutral-900/60 border border-black/10 dark:border-white/10"
            )}
          >
            Glass Button
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-2 text-[11px] font-medium transition-all rounded-lg",
              enabled
                ? "liquid-glass-button-scope"
                : "scope-solid text-primary-foreground"
            )}
          >
            Scope Tinted
          </button>
        </div>
      </div>
    </div>
  );
}
