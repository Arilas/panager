import { useState, useEffect, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/Dialog";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";
import { useEditorsStore } from "../../stores/editors";
import { invoke } from "@tauri-apps/api/core";
import {
  Sun,
  Moon,
  Monitor,
  Keyboard,
  FolderOpen,
  GitBranch,
  Code,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface TempProjectInfo {
  id: string;
  name: string;
  path: string;
  last_activity: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs.Root defaultValue="general" className="flex min-h-[400px]">
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              "border-r border-black/5 dark:border-white/5",
              "p-2"
            )}
          >
            <TabTrigger value="general">General</TabTrigger>
            <TabTrigger value="editors">Editors</TabTrigger>
            <TabTrigger value="shortcuts">Shortcuts</TabTrigger>
          </Tabs.List>

          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs.Content value="general">
              <GeneralSettings />
            </Tabs.Content>
            <Tabs.Content value="editors">
              <EditorsSettings />
            </Tabs.Content>
            <Tabs.Content value="shortcuts">
              <ShortcutsSettings />
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
  const [tempPath, setTempPath] = useState(settings.temp_project_path);
  const [cleanupCandidates, setCleanupCandidates] = useState<TempProjectInfo[]>([]);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchCleanupCandidates = useCallback(async () => {
    try {
      const candidates = await invoke<TempProjectInfo[]>("get_cleanup_candidates");
      setCleanupCandidates(candidates);
    } catch (error) {
      console.error("Failed to get cleanup candidates:", error);
    }
  }, []);

  useEffect(() => {
    setTempPath(settings.temp_project_path);
  }, [settings.temp_project_path]);

  useEffect(() => {
    fetchCleanupCandidates();
  }, [fetchCleanupCandidates, settings.temp_project_cleanup_days]);

  const handleTempPathBlur = async () => {
    if (tempPath !== settings.temp_project_path) {
      await updateSetting("temp_project_path", tempPath);
    }
  };

  const handleCleanupNow = async () => {
    setCleaningUp(true);
    try {
      const count = await invoke<number>("cleanup_temp_projects_now");
      if (count > 0) {
        await fetchCleanupCandidates();
      }
    } catch (error) {
      console.error("Failed to cleanup:", error);
    } finally {
      setCleaningUp(false);
    }
  };

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

      <Section
        title="Temp Projects"
        icon={<FolderOpen className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Temp project folder
            </label>
            <Input
              value={tempPath}
              onChange={(e) => setTempPath(e.target.value)}
              onBlur={handleTempPathBlur}
              placeholder="Leave empty for system default"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Auto-delete after
            </label>
            <select
              value={settings.temp_project_cleanup_days}
              onChange={(e) =>
                updateSetting("temp_project_cleanup_days", Number(e.target.value))
              }
              className={cn(
                "h-9 px-3 rounded-md text-[13px]",
                "bg-white/60 dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-none focus:ring-2 focus:ring-primary/30"
              )}
            >
              <option value={3}>3 days of inactivity</option>
              <option value={7}>7 days of inactivity</option>
              <option value={14}>14 days of inactivity</option>
              <option value={30}>30 days of inactivity</option>
              <option value={0}>Never auto-delete</option>
            </select>
          </div>

          {/* Cleanup Button */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-muted-foreground">
                  {cleanupCandidates.length > 0 ? (
                    <>
                      {cleanupCandidates.length} project
                      {cleanupCandidates.length !== 1 ? "s" : ""} ready for cleanup
                    </>
                  ) : (
                    "No projects ready for cleanup"
                  )}
                </p>
              </div>
              <button
                onClick={handleCleanupNow}
                disabled={cleaningUp || cleanupCandidates.length === 0}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px]",
                  "bg-red-500/10 text-red-600 dark:text-red-400",
                  "hover:bg-red-500/20 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {cleaningUp ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {cleaningUp ? "Cleaning..." : "Cleanup Now"}
              </button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function EditorsSettings() {
  const { editors, syncEditors, deleteEditor } = useEditorsStore();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEditors();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Detected Editors" icon={<Code className="h-4 w-4" />}>
        <div className="space-y-2">
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
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              "w-full mt-2 py-2 rounded-md text-[13px]",
              "bg-black/5 dark:bg-white/10",
              "hover:bg-black/10 dark:hover:bg-white/15",
              "disabled:opacity-50 transition-colors"
            )}
          >
            {syncing ? "Scanning..." : "Rescan for Editors"}
          </button>
        </div>
      </Section>
    </div>
  );
}

function ShortcutsSettings() {
  const { settings } = useSettingsStore();

  return (
    <div className="space-y-6">
      <Section title="Keyboard Shortcuts" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-3">
          <ShortcutRow
            label="Open Panager"
            shortcut={settings.global_hotkey.replace("CmdOrCtrl", "\u2318")}
          />
          <ShortcutRow label="Command Palette" shortcut="\u2318K" />
          <ShortcutRow label="Close Dialog" shortcut="Esc" />
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
