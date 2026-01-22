/**
 * IDE Settings Dialog
 *
 * Settings dialog for IDE-specific settings with three-level configuration:
 * User → Scope → Workspace
 *
 * Uses the same design pattern as the base app's SettingsDialog.
 */

import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Layout,
  Code,
  GitBranch,
  Wrench,
  Bot,
  ChevronDown,
  User,
  Building2,
  FolderOpen,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/Dialog";
import { TabTrigger } from "../ui/TabTrigger";
import { cn } from "../../lib/utils";
import { useIdeSettingsStore } from "../../stores/settings";
import { useIdeStore } from "../../stores/ide";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import type { SettingsLevel } from "../../types/settings";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { EditorSettingsTab } from "./EditorSettingsTab";
import { GitSettingsTab } from "./GitSettingsTab";
import { BehaviorSettingsTab } from "./BehaviorSettingsTab";
import { AgentSettingsTab } from "./AgentSettingsTab";

interface IdeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IdeSettingsDialog({
  open,
  onOpenChange,
}: IdeSettingsDialogProps) {
  const liquidGlass = useLiquidGlass();
  const projectPath = useIdeStore((s) => s.projectContext?.projectPath);
  const projectName = useIdeStore((s) => s.projectContext?.projectName);
  // Use individual selectors to avoid re-renders from object destructuring
  const loadSettings = useIdeSettingsStore((s) => s.loadSettings);
  const loadSettingsForLevel = useIdeSettingsStore(
    (s) => s.loadSettingsForLevel,
  );
  const loadAllLevelSettings = useIdeSettingsStore(
    (s) => s.loadAllLevelSettings,
  );
  const scopeDefaultFolder = useIdeSettingsStore((s) => s.scopeDefaultFolder);

  // Currently selected settings level for editing
  const [selectedLevel, setSelectedLevel] =
    useState<SettingsLevel>("workspace");
  const [levelSelectorOpen, setLevelSelectorOpen] = useState(false);

  // Load settings when dialog opens (always reload to ensure fresh data)
  // Note: We intentionally omit store functions from deps as zustand functions are stable
  useEffect(() => {
    console.log("loadSettingsDialog useEffect", open, projectPath);
    if (open && projectPath) {
      console.log("loadSettingsDialog");
      loadSettings();
      loadSettingsForLevel(selectedLevel);
      loadAllLevelSettings(); // Load raw settings for override detection
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectPath]);

  // Load level-specific settings when level changes
  useEffect(() => {
    if (open && projectPath) {
      loadSettingsForLevel(selectedLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, open, projectPath]);

  const canEditScope = !!scopeDefaultFolder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0">
        {!liquidGlass && (
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle>IDE Settings</DialogTitle>
              <LevelSelector
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                canEditScope={canEditScope}
                open={levelSelectorOpen}
                onOpenChange={setLevelSelectorOpen}
                projectName={projectName}
              />
            </div>
          </DialogHeader>
        )}
        <Tabs.Root
          defaultValue="general"
          className="flex sm:max-w-[700px] max-h-[500px]"
        >
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              liquidGlass
                ? "p-3 liquid-glass-sidebar gap-1 pt-10"
                : "p-2 pt-6 border-r border-black/5 dark:border-white/5",
            )}
          >
            <TabTrigger value="general" icon={<Layout className="h-4 w-4" />}>
              General
            </TabTrigger>
            <TabTrigger value="editor" icon={<Code className="h-4 w-4" />}>
              Editor
            </TabTrigger>
            <TabTrigger value="git" icon={<GitBranch className="h-4 w-4" />}>
              Git
            </TabTrigger>
            <TabTrigger value="behavior" icon={<Wrench className="h-4 w-4" />}>
              Behavior
            </TabTrigger>
            <TabTrigger value="agent" icon={<Bot className="h-4 w-4" />}>
              Agent
            </TabTrigger>
          </Tabs.List>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {liquidGlass && (
                <DialogHeader className="px-6 pt-4 pb-2 shrink-0 sticky top-0 z-50 backdrop-blur-xs">
                  <div className="flex items-center justify-between">
                    <DialogTitle>IDE Settings</DialogTitle>
                    <LevelSelector
                      selectedLevel={selectedLevel}
                      onSelectLevel={setSelectedLevel}
                      canEditScope={canEditScope}
                      open={levelSelectorOpen}
                      onOpenChange={setLevelSelectorOpen}
                      projectName={projectName}
                    />
                  </div>
                </DialogHeader>
              )}
              <Tabs.Content
                value="general"
                className="px-6 pt-2 pb-6 outline-none"
              >
                <GeneralSettingsTab level={selectedLevel} />
              </Tabs.Content>
              <Tabs.Content
                value="editor"
                className="px-6 pt-2 pb-6 outline-none"
              >
                <EditorSettingsTab level={selectedLevel} />
              </Tabs.Content>
              <Tabs.Content value="git" className="px-6 pt-2 pb-6 outline-none">
                <GitSettingsTab level={selectedLevel} />
              </Tabs.Content>
              <Tabs.Content
                value="behavior"
                className="px-6 pt-2 pb-6 outline-none"
              >
                <BehaviorSettingsTab level={selectedLevel} />
              </Tabs.Content>
              <Tabs.Content
                value="agent"
                className="px-6 pt-2 pb-6 outline-none"
              >
                <AgentSettingsTab level={selectedLevel} />
              </Tabs.Content>
            </div>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}

// Level Selector Component
interface LevelSelectorProps {
  selectedLevel: SettingsLevel;
  onSelectLevel: (level: SettingsLevel) => void;
  canEditScope: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
}

function LevelSelector({
  selectedLevel,
  onSelectLevel,
  canEditScope,
  open,
  onOpenChange,
  projectName,
}: LevelSelectorProps) {
  const levels: {
    level: SettingsLevel;
    label: string;
    icon: React.ReactNode;
    disabled?: boolean;
  }[] = [
    { level: "user", label: "User", icon: <User className="w-4 h-4" /> },
    {
      level: "scope",
      label: "Scope",
      icon: <Building2 className="w-4 h-4" />,
      disabled: !canEditScope,
    },
    {
      level: "workspace",
      label: projectName || "Workspace",
      icon: <FolderOpen className="w-4 h-4" />,
    },
  ];

  const selectedLevelInfo = levels.find((l) => l.level === selectedLevel);

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px]",
          "transition-colors",
          "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10",
          "text-foreground/70",
        )}
      >
        {selectedLevelInfo?.icon}
        <span>{selectedLevelInfo?.label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              "absolute right-0 top-full mt-1 z-20",
              "w-48 rounded-lg shadow-lg overflow-hidden",
              "bg-popover border border-border",
            )}
          >
            {levels.map(({ level, label, icon, disabled }) => (
              <button
                key={level}
                onClick={() => {
                  if (!disabled) {
                    onSelectLevel(level);
                    onOpenChange(false);
                  }
                }}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left",
                  "transition-colors",
                  disabled && "opacity-50 cursor-not-allowed",
                  !disabled && "hover:bg-black/5 dark:hover:bg-white/5",
                  selectedLevel === level && "bg-primary/10 text-primary",
                )}
              >
                {icon}
                <span className="flex-1">{label}</span>
                {selectedLevel === level && <Check className="w-4 h-4" />}
                {disabled && (
                  <span className="text-xs text-muted-foreground">
                    No folder
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
