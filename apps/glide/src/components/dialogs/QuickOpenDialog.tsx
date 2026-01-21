/**
 * Quick Open Dialog (Cmd+P)
 *
 * Command palette for file search, settings, and quick actions using cmdk.
 */

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  Search,
  File,
  Settings,
  PanelLeft,
  PanelBottom,
  MessageSquare,
  GitBranch,
  Hash,
  AtSign,
  Check,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { searchFileNames } from "../../lib/tauri-ide";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface QuickOpenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickOpenDialog({ open, onOpenChange }: QuickOpenDialogProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const openFile = useFilesStore((s) => s.openFile);
  const useLiquidGlassEnabled = useLiquidGlass();

  // UI state for toggles
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useIdeStore((s) => s.toggleSidebar);
  const bottomPanelOpen = useIdeStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useIdeStore((s) => s.toggleBottomPanel);
  const rightSidebarCollapsed = useIdeStore((s) => s.rightSidebarCollapsed);
  const toggleRightSidebar = useIdeStore((s) => s.toggleRightSidebar);
  const gitBlameEnabled = useIdeStore((s) => s.gitBlameEnabled);
  const toggleGitBlame = useIdeStore((s) => s.toggleGitBlame);
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const setShowGoToSymbol = useIdeStore((s) => s.setShowGoToSymbol);
  const setShowBranchSwitch = useIdeStore((s) => s.setShowBranchSwitch);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setResults([]);
    }
  }, [open]);

  // Search files with debounce
  useEffect(() => {
    if (!open || !projectContext || !search.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const files = await searchFileNames(
          projectContext.projectPath,
          search,
          20
        );
        setResults(files);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [search, projectContext, open]);

  const handleSelectFile = useCallback(
    (file: string) => {
      if (projectContext) {
        const fullPath = `${projectContext.projectPath}/${file}`;
        openFile(fullPath);
        onOpenChange(false);
      }
    },
    [projectContext, openFile, onOpenChange]
  );

  const handleOpenSettings = useCallback(() => {
    onOpenChange(false);
    setShowSettingsDialog(true);
  }, [onOpenChange, setShowSettingsDialog]);

  const handleGoToLine = useCallback(() => {
    onOpenChange(false);
    setShowGoToLine(true);
  }, [onOpenChange, setShowGoToLine]);

  const handleGoToSymbol = useCallback(() => {
    onOpenChange(false);
    setShowGoToSymbol(true);
  }, [onOpenChange, setShowGoToSymbol]);

  const handleSwitchBranch = useCallback(() => {
    onOpenChange(false);
    setShowBranchSwitch(true);
  }, [onOpenChange, setShowBranchSwitch]);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    onOpenChange(false);
  }, [toggleSidebar, onOpenChange]);

  const handleToggleBottomPanel = useCallback(() => {
    toggleBottomPanel();
    onOpenChange(false);
  }, [toggleBottomPanel, onOpenChange]);

  const handleToggleChat = useCallback(() => {
    toggleRightSidebar();
    onOpenChange(false);
  }, [toggleRightSidebar, onOpenChange]);

  const handleToggleGitBlame = useCallback(() => {
    toggleGitBlame();
    onOpenChange(false);
  }, [toggleGitBlame, onOpenChange]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Quick Open"
      overlayClassName={
        useLiquidGlassEnabled
          ? "bg-transparent!"
          : "bg-black/40 backdrop-blur-xs"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[560px] -translate-x-1/2",
        "shadow-2xl overflow-hidden",
        useLiquidGlassEnabled
          ? "liquid-glass-command liquid-glass-animate"
          : [
              "rounded-xl",
              "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
            ]
      )}
    >
      <div
        className={cn(
          "flex items-center px-4",
          useLiquidGlassEnabled
            ? "border-b border-white/10"
            : "border-b border-black/5 dark:border-white/5"
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search files, commands, or settings..."
          className={cn(
            "flex-1 h-12 px-3 text-[14px] bg-transparent",
            "placeholder:text-muted-foreground/50",
            "focus:outline-hidden"
          )}
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
        )}
      </div>

      <Command.List
        className={cn(
          "max-h-[400px] overflow-y-auto",
          useLiquidGlassEnabled ? "p-1" : "p-2",
          "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5",
          "**:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium",
          "**:[[cmdk-group-heading]]:text-muted-foreground/60 **:[[cmdk-group-heading]]:uppercase",
          "**:[[cmdk-group-heading]]:tracking-wide"
        )}
      >
        <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/60">
          No results found.
        </Command.Empty>

        {/* Actions */}
        <Command.Group heading="Actions">
          <Command.Item
            value="settings preferences"
            onSelect={handleOpenSettings}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Command.Item>
          <Command.Item
            value="go to line number"
            onSelect={handleGoToLine}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <Hash className="h-4 w-4" />
            Go to Line
          </Command.Item>
          <Command.Item
            value="go to symbol function class"
            onSelect={handleGoToSymbol}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <AtSign className="h-4 w-4" />
            Go to Symbol
          </Command.Item>
          <Command.Item
            value="switch branch git checkout"
            onSelect={handleSwitchBranch}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <GitBranch className="h-4 w-4" />
            Switch Branch
          </Command.Item>
        </Command.Group>

        {/* Toggles */}
        <Command.Group heading="View">
          <Command.Item
            value="toggle sidebar panel"
            onSelect={handleToggleSidebar}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="flex-1">Toggle Sidebar</span>
            {!sidebarCollapsed && (
              <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </Command.Item>
          <Command.Item
            value="toggle bottom panel terminal problems"
            onSelect={handleToggleBottomPanel}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <PanelBottom className="h-4 w-4" />
            <span className="flex-1">Toggle Bottom Panel</span>
            {bottomPanelOpen && (
              <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </Command.Item>
          <Command.Item
            value="toggle chat ai assistant"
            onSelect={handleToggleChat}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="flex-1">Toggle Chat</span>
            {!rightSidebarCollapsed && (
              <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </Command.Item>
          <Command.Item
            value="toggle git blame annotations"
            onSelect={handleToggleGitBlame}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <GitBranch className="h-4 w-4" />
            <span className="flex-1">Toggle Git Blame</span>
            {gitBlameEnabled && (
              <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </Command.Item>
        </Command.Group>

        {/* Files */}
        {results.length > 0 && (
          <Command.Group heading="Files">
            {results.map((file) => (
              <Command.Item
                key={file}
                value={`file ${file}`}
                onSelect={() => handleSelectFile(file)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-[13px] text-foreground/90",
                  "aria-selected:bg-primary/10 aria-selected:text-primary",
                  "transition-colors"
                )}
              >
                <File className="h-4 w-4 shrink-0" />
                <span className="truncate">{file}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div
        className={cn(
          "flex items-center justify-between px-4 py-2",
          useLiquidGlassEnabled
            ? "border-t border-white/10"
            : "border-t border-black/5 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
              ↵
            </kbd>{" "}
            Select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
              esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
