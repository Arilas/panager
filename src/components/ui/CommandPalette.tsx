import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  Search,
  Folder,
  FolderOpen,
  Settings,
  Plus,
  ExternalLink,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useProjectsStore } from "../../stores/projects";
import { useEditorsStore } from "../../stores/editors";
import { useSettingsStore } from "../../stores/settings";
import type { ProjectWithStatus, ScopeWithLinks } from "../../types";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewScopeClick: () => void;
  onSettingsClick: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewScopeClick,
  onSettingsClick,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const { scopes, setCurrentScope } = useScopesStore();
  const { allProjects, fetchAllProjects, openInEditor, updateLastOpened } =
    useProjectsStore();
  const { getDefaultEditor } = useEditorsStore();
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  useEffect(() => {
    if (open) {
      fetchAllProjects();
    }
  }, [open, fetchAllProjects]);

  const handleSelectProject = useCallback(
    async (project: ProjectWithStatus) => {
      const editor = getDefaultEditor();
      if (editor) {
        await openInEditor(
          editor.command,
          project.project.path,
          project.project.workspaceFile ?? undefined
        );
        await updateLastOpened(project.project.id);
      }
      onOpenChange(false);
    },
    [getDefaultEditor, openInEditor, updateLastOpened, onOpenChange]
  );

  const handleSelectScope = useCallback(
    (scope: ScopeWithLinks) => {
      setCurrentScope(scope.scope.id);
      onOpenChange(false);
    },
    [setCurrentScope, onOpenChange]
  );

  const handleNewScope = useCallback(() => {
    onOpenChange(false);
    onNewScopeClick();
  }, [onOpenChange, onNewScopeClick]);

  const handleSettings = useCallback(() => {
    onOpenChange(false);
    onSettingsClick();
  }, [onOpenChange, onSettingsClick]);

  const getScopeForProject = (scopeId: string): ScopeWithLinks | undefined => {
    return scopes.find((s) => s.scope.id === scopeId);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Palette"
      overlayClassName={
        useLiquidGlass ? "!bg-transparent" : "bg-black/40 backdrop-blur-sm"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[560px] -translate-x-1/2",
        "shadow-2xl overflow-hidden",
        useLiquidGlass
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
          useLiquidGlass
            ? "border-b border-white/10"
            : "border-b border-black/5 dark:border-white/5"
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search projects, scopes, or actions..."
          className={cn(
            "flex-1 h-12 px-3 text-[14px] bg-transparent",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none"
          )}
        />
      </div>

      <Command.List
        className={cn(
          "max-h-[400px] overflow-y-auto",
          useLiquidGlass ? "p-1" : "p-2",
          "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
          "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium",
          "[&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase",
          "[&_[cmdk-group-heading]]:tracking-wide"
        )}
      >
        <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/60">
          No results found.
        </Command.Empty>

        {/* Quick Actions */}
        <Command.Group heading="Actions">
          <Command.Item
            onSelect={handleNewScope}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <Plus className="h-4 w-4" />
            New Scope
          </Command.Item>
          <Command.Item
            onSelect={handleSettings}
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
        </Command.Group>

        {/* Scopes */}
        {scopes.length > 0 && (
          <Command.Group heading="Scopes">
            {scopes.map((scope) => (
              <Command.Item
                key={scope.scope.id}
                value={`scope ${scope.scope.name}`}
                onSelect={() => handleSelectScope(scope)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "text-[13px] text-foreground/90",
                  "aria-selected:bg-primary/10 aria-selected:text-primary",
                  "transition-colors"
                )}
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: scope.scope.color || "#3b82f6" }}
                />
                <span className="flex-1">{scope.scope.name}</span>
                <span className="text-[11px] text-muted-foreground/50">
                  {
                    allProjects.filter(
                      (p) => p.project.scopeId === scope.scope.id
                    ).length
                  }{" "}
                  projects
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Projects */}
        {allProjects.length > 0 && (
          <Command.Group heading="Projects">
            {allProjects.slice(0, 20).map((project) => {
              const scope = getScopeForProject(project.project.scopeId);
              return (
                <Command.Item
                  key={project.project.id}
                  value={`project ${project.project.name} ${project.project.path}`}
                  onSelect={() => handleSelectProject(project)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                    "text-[13px] text-foreground/90",
                    "aria-selected:bg-primary/10 aria-selected:text-primary",
                    "transition-colors"
                  )}
                >
                  {project.project.isTemp ? (
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Folder className="h-4 w-4" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {project.project.name}
                      </span>
                      {project.gitStatus?.branch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground/70">
                          {project.gitStatus.branch}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground/50 truncate">
                      {scope?.scope.name || "Unknown scope"}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 opacity-0 group-aria-selected:opacity-50" />
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>

      <div
        className={cn(
          "flex items-center justify-between px-4 py-2",
          useLiquidGlass
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
