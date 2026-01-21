/**
 * File Tree Panel - Explorer sidebar
 *
 * Styled with theme support to match Panager's design.
 * Includes context menu, inline file/folder creation, clipboard operations.
 */

import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useEditorStore } from "../../stores/editor";
import { useGitStore } from "../../stores/git";
import { useTerminalsStore } from "../../../stores/terminals";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import { useRevealActiveFile } from "../../hooks/useRevealActiveFile";
import { revealInFinder } from "../../lib/tauri-ide";
import { openTerminal } from "../../../lib/tauri";
import { FileTreeContextMenu } from "./FileTreeContextMenu";
import { InlineEditInput } from "./InlineEditInput";
import { ClipboardIndicator } from "./ClipboardIndicator";
import { DeleteFileDialog, MoveFileDialog } from "./FileOperationDialog";
import type { FileEntry, GitFileStatus } from "../../types";

/** Map of file paths to their git status */
type GitStatusMap = Map<string, GitFileStatus>;

/** Context menu state */
interface ContextMenuState {
  x: number;
  y: number;
  entry: FileEntry;
}

/** Delete dialog state */
interface DeleteDialogState {
  path: string;
  isDirectory: boolean;
}

/** Move dialog state */
interface MoveDialogState {
  items: string[];
  targetDir: string;
}

export function FileTreePanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const tree = useFilesStore((s) => s.tree);
  const treeLoading = useFilesStore((s) => s.treeLoading);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);
  const clipboard = useFilesStore((s) => s.clipboard);
  const creatingEntry = useFilesStore((s) => s.creatingEntry);
  const renamingPath = useFilesStore((s) => s.renamingPath);
  const copyToClipboard = useFilesStore((s) => s.copyToClipboard);
  const cutToClipboard = useFilesStore((s) => s.cutToClipboard);
  const clearClipboard = useFilesStore((s) => s.clearClipboard);
  const pasteFromClipboard = useFilesStore((s) => s.pasteFromClipboard);
  const startCreating = useFilesStore((s) => s.startCreating);
  const cancelCreating = useFilesStore((s) => s.cancelCreating);
  const confirmCreating = useFilesStore((s) => s.confirmCreating);
  const startRenaming = useFilesStore((s) => s.startRenaming);
  const cancelRenaming = useFilesStore((s) => s.cancelRenaming);
  const confirmRenaming = useFilesStore((s) => s.confirmRenaming);
  const deleteEntry = useFilesStore((s) => s.deleteEntry);
  const expandDirectory = useFilesStore((s) => s.expandDirectory);
  const gitChanges = useGitStore((s) => s.changes);
  const { getDefaultTerminal } = useTerminalsStore();
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  // Ref for the scrollable tree container
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Confirmation dialog states
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Auto-reveal active file in tree when tab changes
  useRevealActiveFile({
    containerRef: treeContainerRef,
    enabled: true,
  });

  // Build a map of file paths to their git status for quick lookup
  // Also propagate status to parent folders
  const gitStatusMap = useMemo<GitStatusMap>(() => {
    const map = new Map<string, GitFileStatus>();
    const projectRoot = projectContext?.projectPath ?? "";

    for (const change of gitChanges) {
      // Use the full path for matching
      const fullPath = projectRoot ? `${projectRoot}/${change.path}` : change.path;
      map.set(fullPath, change.status);

      // Propagate status to all parent directories
      // Parent folders show "modified" if they contain any changed files
      let parentPath = fullPath;
      while (true) {
        const lastSlash = parentPath.lastIndexOf("/");
        if (lastSlash <= 0 || (projectRoot && parentPath === projectRoot)) break;

        parentPath = parentPath.substring(0, lastSlash);

        // Only set if not already set (first change wins for folders)
        // Use "modified" as the generic status for folders with changes
        if (!map.has(parentPath)) {
          map.set(parentPath, "modified");
        }
      }
    }
    return map;
  }, [gitChanges, projectContext]);

  const handleRefresh = () => {
    if (projectContext) {
      loadFileTree(projectContext.projectPath);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Context menu action handlers
  const handleNewFile = async () => {
    if (!contextMenu || !projectContext) return;
    const parentPath = contextMenu.entry.isDirectory
      ? contextMenu.entry.path
      : contextMenu.entry.path.substring(0, contextMenu.entry.path.lastIndexOf("/"));

    // Ensure parent is expanded
    await expandDirectory(parentPath, projectContext.projectPath);
    startCreating(parentPath, false);
  };

  const handleNewFolder = async () => {
    if (!contextMenu || !projectContext) return;
    const parentPath = contextMenu.entry.isDirectory
      ? contextMenu.entry.path
      : contextMenu.entry.path.substring(0, contextMenu.entry.path.lastIndexOf("/"));

    // Ensure parent is expanded
    await expandDirectory(parentPath, projectContext.projectPath);
    startCreating(parentPath, true);
  };

  const handleRename = () => {
    if (!contextMenu) return;
    startRenaming(contextMenu.entry.path);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    setDeleteDialog({
      path: contextMenu.entry.path,
      isDirectory: contextMenu.entry.isDirectory,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    setDialogLoading(true);
    try {
      await deleteEntry(deleteDialog.path);
      setDeleteDialog(null);
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCopy = () => {
    if (!contextMenu) return;
    copyToClipboard([contextMenu.entry.path]);
  };

  const handleCut = () => {
    if (!contextMenu) return;
    cutToClipboard([contextMenu.entry.path]);
  };

  const handlePaste = async () => {
    if (!contextMenu) return;
    const targetDir = contextMenu.entry.isDirectory
      ? contextMenu.entry.path
      : contextMenu.entry.path.substring(0, contextMenu.entry.path.lastIndexOf("/"));

    // If it's a cut operation, show confirmation dialog
    if (clipboard.operation === "cut") {
      setMoveDialog({
        items: clipboard.items,
        targetDir,
      });
    } else {
      // For copy, just paste directly
      await pasteFromClipboard(targetDir);
    }
  };

  const handleConfirmMove = async () => {
    if (!moveDialog) return;
    setDialogLoading(true);
    try {
      await pasteFromClipboard(moveDialog.targetDir);
      setMoveDialog(null);
    } catch (error) {
      console.error("Failed to move:", error);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCopyPath = () => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.entry.path);
  };

  const handleCopyRelativePath = () => {
    if (!contextMenu || !projectContext) return;
    const relativePath = contextMenu.entry.path.replace(
      projectContext.projectPath + "/",
      ""
    );
    navigator.clipboard.writeText(relativePath);
  };

  const handleRevealInFinder = async () => {
    if (!contextMenu) return;
    await revealInFinder(contextMenu.entry.path);
  };

  const handleOpenInTerminal = async () => {
    if (!contextMenu) return;
    const dirPath = contextMenu.entry.isDirectory
      ? contextMenu.entry.path
      : contextMenu.entry.path.substring(0, contextMenu.entry.path.lastIndexOf("/"));
    const defaultTerminal = getDefaultTerminal();
    await openTerminal(dirPath, defaultTerminal?.execTemplate);
  };

  // Check if we should show inline input at root level (for creating in project root)
  const showRootCreating =
    creatingEntry && creatingEntry.parentPath === projectContext?.projectPath;

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
          Explorer
        </span>
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
              treeLoading && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Project name with create buttons */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <span
          className={cn(
            "text-sm font-medium truncate",
            isDark ? "text-neutral-300" : "text-neutral-700"
          )}
        >
          {projectContext?.projectName}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => projectContext && startCreating(projectContext.projectPath, false)}
            className={cn(
              "p-1 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="New File"
          >
            <FilePlus
              className={cn(
                "w-3.5 h-3.5",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}
            />
          </button>
          <button
            onClick={() => projectContext && startCreating(projectContext.projectPath, true)}
            className={cn(
              "p-1 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10"
            )}
            title="New Folder"
          >
            <FolderPlus
              className={cn(
                "w-3.5 h-3.5",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}
            />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div ref={treeContainerRef} className="flex-1 overflow-auto py-1 group/tree select-none">
        {treeLoading && tree.length === 0 ? (
          <div
            className={cn(
              "px-3 py-4 text-sm",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            Loading...
          </div>
        ) : tree.length === 0 ? (
          <div
            className={cn(
              "px-3 py-4 text-sm",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            No files found
          </div>
        ) : (
          <>
            {/* Inline input for creating at root level */}
            {showRootCreating && (
              <InlineEditInput
                isDirectory={creatingEntry!.isDirectory}
                onConfirm={confirmCreating}
                onCancel={cancelCreating}
                placeholder={creatingEntry!.isDirectory ? "folder name" : "file name"}
                depth={0}
              />
            )}
            {tree.map((entry, index) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                guideLines={[]}
                isLast={index === tree.length - 1}
                gitStatusMap={gitStatusMap}
                onContextMenu={handleContextMenu}
                clipboard={clipboard}
                creatingEntry={creatingEntry}
                renamingPath={renamingPath}
                onConfirmCreating={confirmCreating}
                onCancelCreating={cancelCreating}
                onConfirmRenaming={confirmRenaming}
                onCancelRenaming={cancelRenaming}
              />
            ))}
          </>
        )}
      </div>

      {/* Clipboard indicator */}
      {clipboard.operation && clipboard.items.length > 0 && (
        <ClipboardIndicator
          items={clipboard.items}
          operation={clipboard.operation}
          onClear={clearClipboard}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          clipboardHasItems={clipboard.items.length > 0}
          onClose={closeContextMenu}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onCopyPath={handleCopyPath}
          onCopyRelativePath={handleCopyRelativePath}
          onRevealInFinder={handleRevealInFinder}
          onOpenInTerminal={handleOpenInTerminal}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <DeleteFileDialog
          open={true}
          onOpenChange={(open) => !open && setDeleteDialog(null)}
          path={deleteDialog.path}
          isDirectory={deleteDialog.isDirectory}
          loading={dialogLoading}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Move confirmation dialog */}
      {moveDialog && (
        <MoveFileDialog
          open={true}
          onOpenChange={(open) => !open && setMoveDialog(null)}
          items={moveDialog.items}
          targetDir={moveDialog.targetDir}
          loading={dialogLoading}
          onConfirm={handleConfirmMove}
        />
      )}
    </div>
  );
}

/** Get color class for git status */
function getGitStatusColor(status: GitFileStatus | undefined): string | undefined {
  if (!status) return undefined;

  switch (status) {
    case "modified":
      return "text-amber-500";
    case "added":
    case "untracked":
      return "text-green-500";
    case "deleted":
      return "text-red-500";
    case "renamed":
      return "text-blue-500";
    case "conflicted":
      return "text-red-600";
    default:
      return undefined;
  }
}

/** Get status indicator letter for git status */
function getGitStatusIndicator(status: GitFileStatus | undefined): string | undefined {
  if (!status) return undefined;

  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "untracked":
      return "U";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "conflicted":
      return "C";
    default:
      return undefined;
  }
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  guideLines: boolean[]; // Array tracking which levels should show guide lines
  isLast: boolean; // Whether this is the last item in its parent
  gitStatusMap: GitStatusMap;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  clipboard: { items: string[]; operation: "copy" | "cut" | null };
  creatingEntry: { parentPath: string; isDirectory: boolean } | null;
  renamingPath: string | null;
  onConfirmCreating: (name: string) => void;
  onCancelCreating: () => void;
  onConfirmRenaming: (name: string) => void;
  onCancelRenaming: () => void;
}

function FileTreeNode({
  entry,
  depth,
  guideLines,
  isLast,
  gitStatusMap,
  onContextMenu,
  clipboard,
  creatingEntry,
  renamingPath,
  onConfirmCreating,
  onCancelCreating,
  onConfirmRenaming,
  onCancelRenaming,
}: FileTreeNodeProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);
  const loadingPaths = useFilesStore((s) => s.loadingPaths);
  const toggleDirectory = useFilesStore((s) => s.toggleDirectory);
  const openFile = useFilesStore((s) => s.openFile);
  const openFilePreview = useFilesStore((s) => s.openFilePreview);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const isExpanded = expandedPaths.has(entry.path);
  const isLoading = loadingPaths.has(entry.path);
  const isActive = activeTabPath === entry.path;
  const isDimmed = entry.isHidden || entry.isGitignored;
  const isBeingRenamed = renamingPath === entry.path;
  const isCutItem = clipboard.operation === "cut" && clipboard.items.includes(entry.path);

  // Get git status for this file/folder
  const gitStatus = gitStatusMap.get(entry.path);
  const gitStatusColor = getGitStatusColor(gitStatus);
  // Only show indicator letter for files, not folders
  const gitStatusIndicator = entry.isDirectory ? undefined : getGitStatusIndicator(gitStatus);

  // Check if we should show inline input for creating inside this folder
  const showCreatingInside =
    entry.isDirectory &&
    isExpanded &&
    creatingEntry &&
    creatingEntry.parentPath === entry.path;

  // Single click - preview for files, toggle for directories
  const handleClick = () => {
    if (isBeingRenamed) return; // Don't handle clicks during rename
    if (entry.isDirectory) {
      if (projectContext) {
        toggleDirectory(entry.path, projectContext.projectPath);
      }
    } else {
      openFilePreview(entry.path);
    }
  };

  // Double click - permanent tab for files
  const handleDoubleClick = () => {
    if (isBeingRenamed) return;
    if (!entry.isDirectory) {
      openFile(entry.path);
    }
  };

  const guideLineColor = isDark
    ? "bg-white/0 group-hover/tree:bg-white/20"
    : "bg-black/0 group-hover/tree:bg-black/15";
  const indentSize = 16; // pixels per indent level
  const baseIndent = 12; // base left padding

  // Build guide line elements for this row
  // Position each line at the center of the indentation level (where chevron would be)
  // Lines are invisible by default, shown on tree hover
  const guideLineElements = guideLines.map((showLine, index) =>
    showLine ? (
      <div
        key={index}
        className={cn("absolute top-0 bottom-0 w-px transition-colors duration-150", guideLineColor)}
        style={{ left: baseIndent + index * indentSize + 8 }}
      />
    ) : null
  );

  // If being renamed, show inline input instead
  if (isBeingRenamed) {
    return (
      <div>
        <InlineEditInput
          initialValue={entry.name}
          isDirectory={entry.isDirectory}
          onConfirm={onConfirmRenaming}
          onCancel={onCancelRenaming}
          depth={depth}
        />
        {/* Still render children if expanded */}
        {entry.isDirectory && isExpanded && entry.children && (
          <div>
            {entry.children.map((child, index) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                guideLines={[...guideLines, !isLast]}
                isLast={index === entry.children!.length - 1}
                gitStatusMap={gitStatusMap}
                onContextMenu={onContextMenu}
                clipboard={clipboard}
                creatingEntry={creatingEntry}
                renamingPath={renamingPath}
                onConfirmCreating={onConfirmCreating}
                onCancelCreating={onCancelCreating}
                onConfirmRenaming={onConfirmRenaming}
                onCancelRenaming={onCancelRenaming}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        data-file-path={entry.path}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className={cn(
          "flex items-center py-0.5 pr-2 cursor-pointer text-sm relative",
          "transition-colors",
          isDark ? "hover:bg-white/5" : "hover:bg-black/5",
          isActive && [
            isDark ? "bg-white/10 text-white" : "bg-black/10 text-neutral-900",
          ],
          isCutItem && "opacity-50"
        )}
        style={{ paddingLeft: baseIndent }}
      >
        {/* Guide lines for this row */}
        {depth > 0 && guideLineElements}

        {/* Indentation spacer */}
        {depth > 0 && <div style={{ width: depth * indentSize }} className="shrink-0" />}

        {/* Expand/collapse icon for directories */}
        {entry.isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isLoading ? (
              <RefreshCw
                className={cn(
                  "w-3 h-3 animate-spin",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            ) : isExpanded ? (
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            ) : (
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Icon */}
        {entry.isDirectory ? (
          isExpanded ? (
            <FolderOpen
              className={cn(
                "w-4 h-4 shrink-0",
                isDimmed ? "text-amber-500/40" : "text-amber-500/80"
              )}
            />
          ) : (
            <Folder
              className={cn(
                "w-4 h-4 shrink-0",
                isDimmed ? "text-amber-500/40" : "text-amber-500/80"
              )}
            />
          )
        ) : (
          <File
            className={cn(
              "w-4 h-4 shrink-0",
              isDimmed
                ? isDark
                  ? "text-neutral-600"
                  : "text-neutral-300"
                : isDark
                  ? "text-neutral-500"
                  : "text-neutral-400"
            )}
          />
        )}

        {/* Name */}
        <span
          className={cn(
            "truncate ml-1",
            isDimmed && (isDark ? "text-neutral-500" : "text-neutral-400"),
            gitStatusColor
          )}
        >
          {entry.name}
        </span>

        {/* Git status indicator */}
        {gitStatusIndicator && (
          <span
            className={cn(
              "ml-auto pl-2 text-xs font-medium shrink-0",
              gitStatusColor
            )}
          >
            {gitStatusIndicator}
          </span>
        )}
      </div>

      {/* Children */}
      {entry.isDirectory && isExpanded && (
        <div>
          {/* Inline input for creating inside this folder */}
          {showCreatingInside && (
            <InlineEditInput
              isDirectory={creatingEntry!.isDirectory}
              onConfirm={onConfirmCreating}
              onCancel={onCancelCreating}
              placeholder={creatingEntry!.isDirectory ? "folder name" : "file name"}
              depth={depth + 1}
            />
          )}
          {entry.children?.map((child, index) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              guideLines={[...guideLines, !isLast]}
              isLast={index === entry.children!.length - 1}
              gitStatusMap={gitStatusMap}
              onContextMenu={onContextMenu}
              clipboard={clipboard}
              creatingEntry={creatingEntry}
              renamingPath={renamingPath}
              onConfirmCreating={onConfirmCreating}
              onCancelCreating={onCancelCreating}
              onConfirmRenaming={onConfirmRenaming}
              onCancelRenaming={onCancelRenaming}
            />
          ))}
        </div>
      )}
    </div>
  );
}
