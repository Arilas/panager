import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";
import { useEditorsStore } from "../../stores/editors";
import {
  Sun,
  Moon,
  Monitor,
  Keyboard,
  GitBranch,
  Code,
  Trash2,
  RefreshCw,
  Check,
  Sparkles,
  Key,
  Droplet,
  Layers,
  Eye,
} from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs.Root defaultValue="general" className="flex h-[400px]">
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              useLiquidGlass
                ? "border-r border-white/10"
                : "border-r border-black/5 dark:border-white/5",
              "p-2"
            )}
          >
            <TabTrigger value="general">General</TabTrigger>
            <TabTrigger value="appearance">Appearance</TabTrigger>
            <TabTrigger value="editors">Editors</TabTrigger>
            <TabTrigger value="shortcuts">Shortcuts</TabTrigger>
            <TabTrigger value="max">Max</TabTrigger>
          </Tabs.List>

          <div className="flex-1 overflow-y-auto">
            <Tabs.Content value="general" className="px-6 pt-2 pb-6">
              <GeneralSettings />
            </Tabs.Content>
            <Tabs.Content value="appearance" className="px-6 pt-2 pb-6">
              <AppearanceSettings />
            </Tabs.Content>
            <Tabs.Content value="editors" className="px-6 pt-2 pb-6">
              <EditorsSettings />
            </Tabs.Content>
            <Tabs.Content value="shortcuts" className="px-6 pt-2 pb-6">
              <ShortcutsSettings />
            </Tabs.Content>
            <Tabs.Content value="max" className="px-6 pt-2 pb-6">
              <MaxSettings />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}

function TabTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "px-3 py-2 text-[13px] rounded-md text-left",
        "text-foreground/70 transition-colors",
        "hover:bg-black/5 dark:hover:bg-white/5",
        "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
        "data-[state=active]:font-medium"
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

function GeneralSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="space-y-6">
      <Section title="Theme" icon={<Sun className="h-4 w-4" />}>
        <div className="flex gap-2">
          <ThemeButton
            active={settings.theme === "light"}
            onClick={() => updateSetting("theme", "light")}
            icon={<Sun className="h-4 w-4" />}
            label="Light"
          />
          <ThemeButton
            active={settings.theme === "dark"}
            onClick={() => updateSetting("theme", "dark")}
            icon={<Moon className="h-4 w-4" />}
            label="Dark"
          />
          <ThemeButton
            active={settings.theme === "system"}
            onClick={() => updateSetting("theme", "system")}
            icon={<Monitor className="h-4 w-4" />}
            label="System"
          />
        </div>
      </Section>

      <Section
        title="Git Refresh Interval"
        icon={<GitBranch className="h-4 w-4" />}
      >
        <div className="flex items-center gap-3">
          <select
            value={settings.git_refresh_interval}
            onChange={(e) =>
              updateSetting("git_refresh_interval", Number(e.target.value))
            }
            className={cn(
              "h-9 px-3 rounded-md text-[13px]",
              "bg-white/60 dark:bg-white/5",
              "border border-black/10 dark:border-white/10",
              "focus:outline-none focus:ring-2 focus:ring-primary/30"
            )}
          >
            <option value={300000}>5 minutes</option>
            <option value={600000}>10 minutes</option>
            <option value={900000}>15 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={3600000}>1 hour</option>
          </select>
          <span className="text-[12px] text-muted-foreground">
            Auto-refresh git status
          </span>
        </div>
      </Section>
    </div>
  );
}

function AppearanceSettings() {
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
                settings.liquid_glass_enabled
                  ? "liquid-glass-card-scope"
                  : "rounded-lg bg-white/60 dark:bg-neutral-900/60 border border-black/10 dark:border-white/10"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[12px] font-medium">Glass Card</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This card demonstrates the Liquid Glass effect with backdrop
                blur.
              </p>
            </div>

            {/* Demo Buttons Row */}
            <div className="flex gap-2">
              <button
                className={cn(
                  "flex-1 px-3 py-2 text-[11px] font-medium transition-all rounded-lg",
                  settings.liquid_glass_enabled
                    ? "liquid-glass-button"
                    : "bg-white/60 dark:bg-neutral-900/60 border border-black/10 dark:border-white/10"
                )}
              >
                Glass Button
              </button>
              <button
                className={cn(
                  "flex-1 px-3 py-2 text-[11px] font-medium transition-all rounded-lg",
                  settings.liquid_glass_enabled
                    ? "liquid-glass-button-scope"
                    : "scope-solid text-primary-foreground"
                )}
              >
                Scope Tinted
              </button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function IntensityButton({
  active,
  onClick,
  label,
  description,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
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

function EditorsSettings() {
  const { editors, syncEditors, deleteEditor, getDefaultEditor } =
    useEditorsStore();
  const { settings, updateSetting } = useSettingsStore();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEditors();
    } finally {
      setSyncing(false);
    }
  };

  const handleSetDefault = async (editorId: string) => {
    await updateSetting("default_editor_id", editorId);
  };

  const currentDefaultId = settings.default_editor_id || getDefaultEditor()?.id;

  return (
    <div className="space-y-6">
      <Section title="Default Editor" icon={<Code className="h-4 w-4" />}>
        <p className="text-[12px] text-muted-foreground mb-3">
          Used when opening projects without a specific editor preference.
        </p>
        <div className="space-y-1.5">
          {editors.filter((e) => e.isAvailable).length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">
              No editors available
            </p>
          ) : (
            editors
              .filter((e) => e.isAvailable)
              .map((editor) => (
                <button
                  key={editor.id}
                  onClick={() => handleSetDefault(editor.id)}
                  className={cn(
                    "w-full flex items-center justify-between",
                    "px-3 py-2.5 rounded-lg text-left",
                    "transition-colors",
                    currentDefaultId === editor.id
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                  )}
                >
                  <div>
                    <div className="text-[13px] font-medium">{editor.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {editor.command}
                    </div>
                  </div>
                  {currentDefaultId === editor.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
          )}
        </div>
      </Section>

      <Section title="All Editors" icon={<Code className="h-4 w-4" />}>
        <div className="space-y-1.5">
          {editors.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">
              No editors detected
            </p>
          ) : (
            editors.map((editor) => (
              <div
                key={editor.id}
                className={cn(
                  "flex items-center justify-between",
                  "px-3 py-2 rounded-lg",
                  "bg-black/[0.02] dark:bg-white/[0.02]",
                  "border border-black/5 dark:border-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      editor.isAvailable ? "bg-green-500" : "bg-red-500"
                    )}
                    title={editor.isAvailable ? "Available" : "Not available"}
                  />
                  <div>
                    <div className="text-[13px] font-medium">{editor.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {editor.command}
                    </div>
                  </div>
                </div>
                {!editor.isAutoDetected && (
                  <button
                    onClick={() => deleteEditor(editor.id)}
                    className={cn(
                      "p-1.5 rounded-md",
                      "hover:bg-red-500/10 text-red-500",
                      "transition-colors"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}
          <Button
            variant="secondary"
            onClick={handleSync}
            loading={syncing}
            className="w-full mt-2"
          >
            {!syncing && <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {syncing ? "Scanning..." : "Rescan for Editors"}
          </Button>
        </div>
      </Section>
    </div>
  );
}

function ShortcutsSettings() {
  const { settings } = useSettingsStore();

  const formatHotkey = (hotkey: string) => {
    return hotkey
      .replace("CmdOrCtrl", "\u2318")
      .replace("Shift", "\u21E7")
      .replace("+", "");
  };

  return (
    <div className="space-y-6">
      <Section title="Global" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow
            label="Open Panager"
            shortcut={formatHotkey(settings.global_hotkey)}
          />
        </div>
      </Section>

      <Section title="Navigation" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow label="Command Palette" shortcut={"\u2318K"} />
          <ShortcutRow label="Toggle Info Panel" shortcut={"\u2318B"} />
        </div>
      </Section>

      <Section title="General" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow label="Close Dialog / Cancel" shortcut="Esc" />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[13px] font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg",
        "text-[13px] transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-foreground/80">{label}</span>
      <kbd
        className={cn(
          "px-2 py-1 rounded-md text-[12px] font-mono",
          "bg-black/5 dark:bg-white/10",
          "border border-black/10 dark:border-white/10"
        )}
      >
        {shortcut}
      </kbd>
    </div>
  );
}

function MaxSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium">Max Features</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Enable advanced integrations for deeper git and SSH configuration
          management per scope.
        </p>
      </div>

      <Section title="Git Integration" icon={<GitBranch className="h-4 w-4" />}>
        <ToggleRow
          label="Deeper Git Integration"
          description="Read git config includeIf sections to detect identity per scope folder. Verify and fix repository configurations."
          checked={settings.max_git_integration}
          onChange={(checked) => updateSetting("max_git_integration", checked)}
        />
      </Section>

      <Section title="SSH Integration" icon={<Key className="h-4 w-4" />}>
        <ToggleRow
          label="Deeper SSH Integration"
          description="Read SSH config to detect host aliases. Create and manage SSH aliases per scope. Verify remote URLs use correct aliases."
          checked={settings.max_ssh_integration}
          onChange={(checked) => updateSetting("max_ssh_integration", checked)}
        />
      </Section>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "transition-colors",
        checked
          ? "bg-primary/10 border border-primary/20"
          : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5",
          checked ? "bg-primary" : "bg-black/20 dark:bg-white/20"
        )}
      >
        <div
          className={cn(
            "w-5 h-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {description}
        </div>
      </div>
    </button>
  );
}
