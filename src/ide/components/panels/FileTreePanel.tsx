/**
 * File Tree Panel - Explorer sidebar
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
import { cn } from "../../../lib/utils";
import type { FileEntry } from "../../types";

export function FileTreePanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const tree = useFilesStore((s) => s.tree);
  const treeLoading = useFilesStore((s) => s.treeLoading);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);

  const handleRefresh = () => {
    if (projectContext) {
      loadFileTree(projectContext.projectPath);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Explorer
        </span>
        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-neutral-800 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5 text-neutral-500",
              treeLoading && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Project name */}
      <div className="px-3 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-800">
        {projectContext?.projectName}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {treeLoading && tree.length === 0 ? (
          <div className="px-3 py-4 text-sm text-neutral-500">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-4 text-sm text-neutral-500">
            No files found
          </div>
        ) : (
          tree.map((entry) => (
            <FileTreeNode key={entry.path} entry={entry} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
}

function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);
  const loadingPaths = useFilesStore((s) => s.loadingPaths);
  const toggleDirectory = useFilesStore((s) => s.toggleDirectory);
  const openFile = useFilesStore((s) => s.openFile);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);

  const isExpanded = expandedPaths.has(entry.path);
  const isLoading = loadingPaths.has(entry.path);
  const isActive = activeFilePath === entry.path;

  const handleClick = () => {
    if (entry.isDirectory) {
      if (projectContext) {
        toggleDirectory(entry.path, projectContext.projectPath);
      }
    } else {
      openFile(entry.path);
    }
  };

  const paddingLeft = 12 + depth * 12;

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 py-0.5 pr-2 cursor-pointer text-sm",
          "hover:bg-neutral-800/50 transition-colors",
          isActive && "bg-neutral-800 text-white"
        )}
        style={{ paddingLeft }}
      >
        {/* Expand/collapse icon for directories */}
        {entry.isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin text-neutral-500" />
            ) : isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Icon */}
        {entry.isDirectory ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500/80 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500/80 shrink-0" />
          )
        ) : (
          <File className="w-4 h-4 text-neutral-500 shrink-0" />
        )}

        {/* Name */}
        <span
          className={cn(
            "truncate",
            entry.isHidden && "text-neutral-500"
          )}
        >
          {entry.name}
        </span>
      </div>

      {/* Children */}
      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
