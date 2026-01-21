/**
 * Git Status Panel
 *
 * Styled with theme support to match Panager's design.
 */

import { useEffect, useState, useMemo, useRef } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
  AlertTriangle,
  File,
  Plus,
  Minus,
  Undo2,
  Package,
  List,
  FolderTree,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useFilesStore } from "../../stores/files";
import { useEditorStore, isDiffTab } from "../../stores/editor";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { useGeneralSettings } from "../../stores/settings";
import { cn } from "../../lib/utils";
import type { GitFileChange, GitFileStatus } from "../../types";
import { CommitInput } from "../git/CommitInput";
import { StashPanel } from "../git/StashPanel";
import { GitChangeTree } from "../git/GitChangeTree";
import { stageFile, unstageFile, discardChanges, getFileDiff } from "../../lib/tauri-ide";

/** Get Monaco language ID from file path */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    toml: "toml",
  };
  return langMap[ext] || "plaintext";
}

export function GitPanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const activePanel = useIdeStore((s) => s.activePanel);
  const {
    changes,
    branch,
    loading,
    loadGitStatus,
    refresh,
    stashSave,
    changesViewMode,
    setChangesViewMode,
  } = useGitStore();
  const openFilePreview = useFilesStore((s) => s.openFilePreview);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const getActiveTabState = useEditorStore((s) => s.getActiveTabState);
  const effectiveTheme = useEffectiveTheme();
  const generalSettings = useGeneralSettings();

  // Initialize view mode from settings on first load
  const hasInitializedViewMode = useRef(false);
  useEffect(() => {
    if (!hasInitializedViewMode.current) {
      const defaultView = generalSettings.git.defaultView;
      if (defaultView && defaultView !== changesViewMode) {
        setChangesViewMode(defaultView);
      }
      hasInitializedViewMode.current = true;
    }
  }, [generalSettings, changesViewMode, setChangesViewMode]);

  // Derive selected file from active tab (diff or regular file)
  const selectedFilePath = useMemo(() => {
    if (!activeTabPath || !projectContext) return null;

    // If diff tab is active, extract the original file path from the diff:// path
    if (activeTabPath.startsWith("diff://")) {
      const activeTab = getActiveTabState();
      if (activeTab && isDiffTab(activeTab)) {
        // Extract original path - remove diff:// prefix and :staged suffix if present
        let originalPath = activeTabPath.slice("diff://".length);
        if (originalPath.endsWith(":staged")) {
          originalPath = originalPath.slice(0, -":staged".length);
        }
        if (originalPath.startsWith(projectContext.projectPath)) {
          return originalPath.slice(projectContext.projectPath.length + 1); // +1 for the "/"
        }
      }
    } else {
      // Regular file tab - extract relative path
      if (activeTabPath.startsWith(projectContext.projectPath)) {
        return activeTabPath.slice(projectContext.projectPath.length + 1);
      }
    }
    return null;
  }, [activeTabPath, getActiveTabState, projectContext]);

  const isDark = effectiveTheme === "dark";

  // Refresh on panel open
  useEffect(() => {
    if (activePanel === "git" && projectContext) {
      loadGitStatus(projectContext.projectPath);
    }
  }, [activePanel, projectContext, loadGitStatus]);

  const handleRefresh = () => {
    if (projectContext) {
      loadGitStatus(projectContext.projectPath);
    }
  };

  const handleStashAll = async () => {
    if (!projectContext) return;
    try {
      await stashSave(projectContext.projectPath, undefined, true);
    } catch (error) {
      console.error("Failed to stash:", error);
    }
  };

  const stagedChanges = changes.filter((c) => c.staged);
  const unstagedChanges = changes.filter(
    (c) => !c.staged && c.status !== "untracked"
  );
  const untrackedChanges = changes.filter((c) => c.status === "untracked");

  const openDiffTab = useEditorStore((s) => s.openDiffTab);

  const handleFileClick = async (file: GitFileChange) => {
    if (!projectContext) return;

    try {
      // Get the diff data from the backend
      const diff = await getFileDiff(projectContext.projectPath, file.path, file.staged);

      if (diff.isBinary) {
        console.warn("Cannot display diff for binary file:", file.path);
        return;
      }

      // Open the diff in a new tab (as preview by default)
      const fileName = file.path.split("/").pop() || file.path;
      const fullPath = `${projectContext.projectPath}/${file.path}`;
      openDiffTab({
        type: "diff",
        path: fullPath,
        filePath: fullPath,
        fileName,
        originalContent: diff.originalContent,
        modifiedContent: diff.modifiedContent,
        language: getLanguageFromPath(file.path),
        staged: file.staged,
      });
    } catch (error) {
      console.error("Failed to load diff:", error);
    }
  };

  const handleStageFile = async (file: GitFileChange) => {
    if (!projectContext) return;
    try {
      await stageFile(projectContext.projectPath, file.path);
      await refresh(projectContext.projectPath);
    } catch (error) {
      console.error("Failed to stage file:", error);
    }
  };

  const handleUnstageFile = async (file: GitFileChange) => {
    if (!projectContext) return;
    try {
      await unstageFile(projectContext.projectPath, file.path);
      await refresh(projectContext.projectPath);
    } catch (error) {
      console.error("Failed to unstage file:", error);
    }
  };

  const handleDiscardChanges = async (file: GitFileChange) => {
    if (!projectContext) return;
    try {
      await discardChanges(projectContext.projectPath, file.path);
      await refresh(projectContext.projectPath);
    } catch (error) {
      console.error("Failed to discard changes:", error);
    }
  };

  const handleStageAll = async () => {
    if (!projectContext) return;
    const filesToStage = [...unstagedChanges, ...untrackedChanges];
    for (const file of filesToStage) {
      try {
        await stageFile(projectContext.projectPath, file.path);
      } catch (error) {
        console.error(`Failed to stage ${file.path}:`, error);
      }
    }
    await refresh(projectContext.projectPath);
  };

  const handleUnstageAll = async () => {
    if (!projectContext) return;
    for (const file of stagedChanges) {
      try {
        await unstageFile(projectContext.projectPath, file.path);
      } catch (error) {
        console.error(`Failed to unstage ${file.path}:`, error);
      }
    }
    await refresh(projectContext.projectPath);
  };

  const handleFileOpen = (file: GitFileChange) => {
    if (projectContext) {
      const fullPath = `${projectContext.projectPath}/${file.path}`;
      openFilePreview(fullPath);
    }
  };

  const toggleViewMode = () => {
    setChangesViewMode(changesViewMode === "list" ? "tree" : "list");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wider",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          Source Control
        </span>
        <div className="flex items-center gap-1">
          {/* View toggle button */}
          <button
            onClick={toggleViewMode}
            className={cn(
              "p-1 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title={changesViewMode === "list" ? "Tree view" : "List view"}
          >
            {changesViewMode === "list" ? (
              <FolderTree
                className={cn(
                  "w-3.5 h-3.5",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            ) : (
              <List
                className={cn(
                  "w-3.5 h-3.5",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            )}
          </button>
          {/* Stash button */}
          {changes.length > 0 && (
            <button
              onClick={handleStashAll}
              className={cn(
                "p-1 rounded transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-black/10"
              )}
              title="Stash all changes"
            >
              <Package
                className={cn(
                  "w-3.5 h-3.5",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            </button>
          )}
          <button
            onClick={handleRefresh}
            className={cn(
              "p-1 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="Refresh"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5",
                isDark ? "text-neutral-500" : "text-neutral-400",
                loading && "animate-spin"
              )}
            />
          </button>
        </div>
      </div>

      {/* Branch info */}
      {branch && (
        <div
          className={cn(
            "px-3 py-2 text-sm",
            "border-b border-black/5 dark:border-white/5"
          )}
        >
          <span className={isDark ? "text-neutral-400" : "text-neutral-500"}>
            On branch{" "}
          </span>
          <span
            className={cn(
              "font-medium",
              isDark ? "text-neutral-200" : "text-neutral-800"
            )}
          >
            {branch.name}
          </span>
        </div>
      )}

      {/* Commit input */}
      <CommitInput stagedCount={stagedChanges.length} />

      {/* Changes */}
      <div className="flex-1 overflow-auto py-1">
        {loading && changes.length === 0 ? (
          <div
            className={cn(
              "px-3 py-4 text-sm",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            Loading...
          </div>
        ) : changes.length === 0 ? (
          <div
            className={cn(
              "px-3 py-4 text-sm",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            No changes detected
          </div>
        ) : changesViewMode === "tree" ? (
          <>
            <GitChangeTree
              stagedChanges={stagedChanges}
              unstagedChanges={unstagedChanges}
              untrackedChanges={untrackedChanges}
              onStage={handleStageFile}
              onUnstage={handleUnstageFile}
              onDiscard={handleDiscardChanges}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              onFileClick={handleFileClick}
              onFileOpen={handleFileOpen}
              selectedPath={selectedFilePath}
            />
            {/* Stash panel */}
            <StashPanel />
          </>
        ) : (
          <>
            {/* Staged changes */}
            {stagedChanges.length > 0 && (
              <ChangeSection
                title="Staged Changes"
                changes={stagedChanges}
                onFileClick={handleFileClick}
                onFileOpen={handleFileOpen}
                selectedPath={selectedFilePath}
                onStage={handleStageFile}
                onUnstage={handleUnstageFile}
                onDiscard={handleDiscardChanges}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
                isStaged
              />
            )}

            {/* Unstaged changes */}
            {unstagedChanges.length > 0 && (
              <ChangeSection
                title="Changes"
                changes={unstagedChanges}
                onFileClick={handleFileClick}
                onFileOpen={handleFileOpen}
                selectedPath={selectedFilePath}
                onStage={handleStageFile}
                onUnstage={handleUnstageFile}
                onDiscard={handleDiscardChanges}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
              />
            )}

            {/* Untracked files */}
            {untrackedChanges.length > 0 && (
              <ChangeSection
                title="Untracked"
                changes={untrackedChanges}
                onFileClick={handleFileClick}
                onFileOpen={handleFileOpen}
                selectedPath={selectedFilePath}
                onStage={handleStageFile}
                onUnstage={handleUnstageFile}
                onDiscard={handleDiscardChanges}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
              />
            )}

            {/* Stash panel */}
            <StashPanel />
          </>
        )}
      </div>
    </div>
  );
}

interface ChangeSectionProps {
  title: string;
  changes: GitFileChange[];
  onFileClick: (file: GitFileChange) => void;
  onFileOpen: (file: GitFileChange) => void;
  selectedPath: string | null;
  onStage: (file: GitFileChange) => void;
  onUnstage: (file: GitFileChange) => void;
  onDiscard: (file: GitFileChange) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  isStaged?: boolean;
}

function ChangeSection({
  title,
  changes,
  onFileClick,
  onFileOpen,
  selectedPath,
  onStage,
  onUnstage,
  onDiscard,
  onStageAll,
  onUnstageAll,
  isStaged = false,
}: ChangeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <div>
      <div
        className={cn(
          "flex items-center w-full px-3 py-1.5 text-xs font-medium",
          isDark ? "text-neutral-400" : "text-neutral-500"
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-1 flex-1",
            isDark ? "hover:text-neutral-300" : "hover:text-neutral-600"
          )}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {title}
          <span className={cn("ml-1", isDark ? "text-neutral-500" : "text-neutral-400")}>
            ({changes.length})
          </span>
        </button>

        {/* Section actions */}
        {isStaged ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnstageAll();
            }}
            className={cn(
              "p-0.5 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="Unstage all"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStageAll();
            }}
            className={cn(
              "p-0.5 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="Stage all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {changes.map((change) => (
            <FileChangeItem
              key={`${change.path}-${change.staged}`}
              change={change}
              isSelected={selectedPath === change.path}
              isDark={isDark}
              onFileClick={() => onFileOpen(change)}
              onShowDiff={() => onFileClick(change)}
              onStage={() => onStage(change)}
              onUnstage={() => onUnstage(change)}
              onDiscard={() => onDiscard(change)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileChangeItemProps {
  change: GitFileChange;
  isSelected: boolean;
  isDark: boolean;
  onFileClick: () => void;
  onShowDiff: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
}

function FileChangeItem({
  change,
  isSelected,
  isDark,
  onFileClick,
  onShowDiff,
  onStage,
  onUnstage,
  onDiscard,
}: FileChangeItemProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-4 py-1 cursor-pointer text-sm",
        "transition-colors",
        isDark ? "hover:bg-white/5" : "hover:bg-black/5",
        isSelected && [isDark ? "bg-white/10" : "bg-black/10"]
      )}
      onClick={onFileClick}
    >
      <StatusIcon status={change.status} />
      <span className="truncate flex-1">{getFileName(change.path)}</span>
      <span
        className={cn(
          "text-xs truncate max-w-[100px] group-hover:opacity-0 transition-opacity",
          isDark ? "text-neutral-600" : "text-neutral-400"
        )}
      >
        {getParentPath(change.path)}
      </span>

      {/* File actions - positioned absolutely to not take space when hidden */}
      <div
        className={cn(
          "absolute right-2 flex items-center gap-0.5",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          isDark ? "bg-neutral-900/90" : "bg-neutral-100/90"
        )}
      >
        {/* Show diff button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowDiff();
          }}
          className={cn(
            "p-0.5 rounded",
            isDark ? "hover:bg-white/10" : "hover:bg-black/10"
          )}
          title="View diff"
        >
          <File className="w-3.5 h-3.5" />
        </button>
        {change.staged ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnstage();
            }}
            className={cn(
              "p-0.5 rounded",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="Unstage"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStage();
              }}
              className={cn(
                "p-0.5 rounded",
                isDark ? "hover:bg-white/10" : "hover:bg-black/10"
              )}
              title="Stage"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {change.status !== "untracked" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscard();
                }}
                className={cn(
                  "p-0.5 rounded text-red-500",
                  isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                )}
                title="Discard changes"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: GitFileStatus }) {
  switch (status) {
    case "added":
      return <FilePlus className="w-4 h-4 text-green-500 shrink-0" />;
    case "deleted":
      return <FileX className="w-4 h-4 text-red-500 shrink-0" />;
    case "modified":
      return <FilePen className="w-4 h-4 text-yellow-500 shrink-0" />;
    case "untracked":
      return <FileQuestion className="w-4 h-4 text-neutral-500 shrink-0" />;
    case "conflicted":
      return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case "renamed":
      return <FilePen className="w-4 h-4 text-blue-500 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-neutral-500 shrink-0" />;
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getParentPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}
