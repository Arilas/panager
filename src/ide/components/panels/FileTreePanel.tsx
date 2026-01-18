/**
 * File Tree Panel - Explorer sidebar
 *
 * Styled with theme support to match Panager's design.
 */

import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { FileEntry } from "../../types";

export function FileTreePanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const tree = useFilesStore((s) => s.tree);
  const treeLoading = useFilesStore((s) => s.treeLoading);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  const handleRefresh = () => {
    if (projectContext) {
      loadFileTree(projectContext.projectPath);
    }
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

      {/* Project name */}
      <div
        className={cn(
          "px-3 py-2 text-sm font-medium",
          "border-b border-black/5 dark:border-white/5",
          isDark ? "text-neutral-300" : "text-neutral-700"
        )}
      >
        {projectContext?.projectName}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1 group/tree">
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
          tree.map((entry, index) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              guideLines={[]}
              isLast={index === tree.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  guideLines: boolean[]; // Array tracking which levels should show guide lines
  isLast: boolean; // Whether this is the last item in its parent
}

function FileTreeNode({ entry, depth, guideLines, isLast }: FileTreeNodeProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);
  const loadingPaths = useFilesStore((s) => s.loadingPaths);
  const toggleDirectory = useFilesStore((s) => s.toggleDirectory);
  const openFile = useFilesStore((s) => s.openFile);
  const openFilePreview = useFilesStore((s) => s.openFilePreview);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const isExpanded = expandedPaths.has(entry.path);
  const isLoading = loadingPaths.has(entry.path);
  const isActive = activeFilePath === entry.path;
  const isDimmed = entry.isHidden || entry.isGitignored;

  // Single click - preview for files, toggle for directories
  const handleClick = () => {
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

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "flex items-center py-0.5 pr-2 cursor-pointer text-sm relative",
          "transition-colors",
          isDark ? "hover:bg-white/5" : "hover:bg-black/5",
          isActive && [
            isDark ? "bg-white/10 text-white" : "bg-black/10 text-neutral-900",
          ]
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
            isDimmed && (isDark ? "text-neutral-500" : "text-neutral-400")
          )}
        >
          {entry.name}
        </span>
      </div>

      {/* Children */}
      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child, index) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              guideLines={[...guideLines, !isLast]}
              isLast={index === entry.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
