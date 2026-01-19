/**
 * Git Change Tree View Component
 *
 * Displays git changes in a hierarchical tree structure grouped by directory.
 */

import { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
  AlertTriangle,
  File,
  Plus,
  Minus,
  Undo2,
} from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { GitFileChange, GitFileStatus } from "../../types";

/** Tree node representing either a directory or a file */
interface GitTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: GitTreeNode[];
  change?: GitFileChange;
}

interface GitChangeTreeProps {
  stagedChanges: GitFileChange[];
  unstagedChanges: GitFileChange[];
  untrackedChanges: GitFileChange[];
  onStage: (file: GitFileChange) => void;
  onUnstage: (file: GitFileChange) => void;
  onDiscard: (file: GitFileChange) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onFileClick: (file: GitFileChange) => void;
  onFileOpen: (file: GitFileChange) => void;
  selectedPath: string | null;
}

/** Build a tree structure from flat file changes */
function buildTree(changes: GitFileChange[]): GitTreeNode[] {
  const root: GitTreeNode[] = [];
  const nodeMap = new Map<string, GitTreeNode>();

  for (const change of changes) {
    const parts = change.path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      if (!nodeMap.has(currentPath)) {
        const node: GitTreeNode = {
          name: parts[i],
          path: currentPath,
          isDirectory: !isFile,
          children: [],
          change: isFile ? change : undefined,
        };
        nodeMap.set(currentPath, node);

        if (parentPath) {
          const parent = nodeMap.get(parentPath);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: GitTreeNode[]): GitTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const sortTree = (nodes: GitTreeNode[]): GitTreeNode[] => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        node.children = sortTree(sortNodes(node.children));
      }
    }
    return sortNodes(nodes);
  };

  return sortTree(root);
}

/** Collect all file changes from a tree node (recursively) */
function collectFilesFromNode(node: GitTreeNode): GitFileChange[] {
  const files: GitFileChange[] = [];

  if (node.change) {
    files.push(node.change);
  }

  for (const child of node.children) {
    files.push(...collectFilesFromNode(child));
  }

  return files;
}

export function GitChangeTree({
  stagedChanges,
  unstagedChanges,
  untrackedChanges,
  onStage,
  onUnstage,
  onDiscard,
  onStageAll,
  onUnstageAll,
  onFileClick,
  onFileOpen,
  selectedPath,
}: GitChangeTreeProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [untrackedExpanded, setUntrackedExpanded] = useState(true);

  const stagedTree = useMemo(() => buildTree(stagedChanges), [stagedChanges]);
  const unstagedTree = useMemo(
    () => buildTree(unstagedChanges),
    [unstagedChanges]
  );
  const untrackedTree = useMemo(
    () => buildTree(untrackedChanges),
    [untrackedChanges]
  );

  return (
    <div className="py-1">
      {/* Staged Changes */}
      {stagedChanges.length > 0 && (
        <TreeSection
          title="Staged Changes"
          count={stagedChanges.length}
          expanded={stagedExpanded}
          onToggle={() => setStagedExpanded(!stagedExpanded)}
          tree={stagedTree}
          isStaged
          onStage={onStage}
          onUnstage={onUnstage}
          onDiscard={onDiscard}
          onStageAll={onStageAll}
          onUnstageAll={onUnstageAll}
          onFileClick={onFileClick}
          onFileOpen={onFileOpen}
          selectedPath={selectedPath}
          isDark={isDark}
        />
      )}

      {/* Unstaged Changes */}
      {unstagedChanges.length > 0 && (
        <TreeSection
          title="Changes"
          count={unstagedChanges.length}
          expanded={changesExpanded}
          onToggle={() => setChangesExpanded(!changesExpanded)}
          tree={unstagedTree}
          onStage={onStage}
          onUnstage={onUnstage}
          onDiscard={onDiscard}
          onStageAll={onStageAll}
          onUnstageAll={onUnstageAll}
          onFileClick={onFileClick}
          onFileOpen={onFileOpen}
          selectedPath={selectedPath}
          isDark={isDark}
        />
      )}

      {/* Untracked Files */}
      {untrackedChanges.length > 0 && (
        <TreeSection
          title="Untracked"
          count={untrackedChanges.length}
          expanded={untrackedExpanded}
          onToggle={() => setUntrackedExpanded(!untrackedExpanded)}
          tree={untrackedTree}
          onStage={onStage}
          onUnstage={onUnstage}
          onDiscard={onDiscard}
          onStageAll={onStageAll}
          onUnstageAll={onUnstageAll}
          onFileClick={onFileClick}
          onFileOpen={onFileOpen}
          selectedPath={selectedPath}
          isDark={isDark}
        />
      )}
    </div>
  );
}

interface TreeSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  tree: GitTreeNode[];
  isStaged?: boolean;
  onStage: (file: GitFileChange) => void;
  onUnstage: (file: GitFileChange) => void;
  onDiscard: (file: GitFileChange) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onFileClick: (file: GitFileChange) => void;
  onFileOpen: (file: GitFileChange) => void;
  selectedPath: string | null;
  isDark: boolean;
}

function TreeSection({
  title,
  count,
  expanded,
  onToggle,
  tree,
  isStaged = false,
  onStage,
  onUnstage,
  onDiscard,
  onStageAll,
  onUnstageAll,
  onFileClick,
  onFileOpen,
  selectedPath,
  isDark,
}: TreeSectionProps) {
  // Collect all directory paths from tree for default expansion
  const allDirectoryPaths = useMemo(() => {
    const paths = new Set<string>();
    const collectPaths = (nodes: GitTreeNode[]) => {
      for (const node of nodes) {
        if (node.isDirectory) {
          paths.add(node.path);
          collectPaths(node.children);
        }
      }
    };
    collectPaths(tree);
    return paths;
  }, [tree]);

  // Track expanded directories within this section - expanded by default
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  );

  // Expand new directories when they appear
  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const path of allDirectoryPaths) {
        next.add(path);
      }
      return next;
    });
  }, [allDirectoryPaths]);

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div>
      {/* Section header */}
      <div
        className={cn(
          "flex items-center w-full px-3 py-1.5 text-xs font-medium",
          isDark ? "text-neutral-400" : "text-neutral-500"
        )}
      >
        <button
          onClick={onToggle}
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
          <span
            className={cn("ml-1", isDark ? "text-neutral-500" : "text-neutral-400")}
          >
            ({count})
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

      {/* Tree content */}
      {expanded && (
        <div>
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              isStaged={isStaged}
              expandedPaths={expandedPaths}
              onTogglePath={togglePath}
              onStage={onStage}
              onUnstage={onUnstage}
              onDiscard={onDiscard}
              onFileClick={onFileClick}
              onFileOpen={onFileOpen}
              selectedPath={selectedPath}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreeNodeProps {
  node: GitTreeNode;
  depth: number;
  isStaged?: boolean;
  expandedPaths: Set<string>;
  onTogglePath: (path: string) => void;
  onStage: (file: GitFileChange) => void;
  onUnstage: (file: GitFileChange) => void;
  onDiscard: (file: GitFileChange) => void;
  onFileClick: (file: GitFileChange) => void;
  onFileOpen: (file: GitFileChange) => void;
  selectedPath: string | null;
  isDark: boolean;
}

function TreeNode({
  node,
  depth,
  isStaged = false,
  expandedPaths,
  onTogglePath,
  onStage,
  onUnstage,
  onDiscard,
  onFileClick,
  onFileOpen,
  selectedPath,
  isDark,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.change && selectedPath === node.change.path;
  const indentSize = 16;
  const baseIndent = 16;

  const handleClick = () => {
    if (node.isDirectory) {
      onTogglePath(node.path);
    } else if (node.change) {
      onFileOpen(node.change);
    }
  };

  const handleDiffClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.change) {
      onFileClick(node.change);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          "group relative flex items-center py-0.5 pr-2 cursor-pointer text-sm",
          "transition-colors",
          isDark ? "hover:bg-white/5" : "hover:bg-black/5",
          isSelected && [isDark ? "bg-white/10" : "bg-black/10"]
        )}
        style={{ paddingLeft: baseIndent + depth * indentSize }}
      >
        {/* Expand/collapse for directories */}
        {node.isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isExpanded ? (
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
        {node.isDirectory ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-amber-500/80" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-amber-500/80" />
          )
        ) : (
          <StatusIcon status={node.change?.status} />
        )}

        {/* Name */}
        <span className="truncate ml-1 flex-1">{node.name}</span>

        {/* Actions - positioned absolutely to not take space when hidden */}
        <div
          className={cn(
            "absolute right-2 flex items-center gap-0.5",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isDark ? "bg-neutral-900/90" : "bg-neutral-100/90"
          )}
        >
          {node.isDirectory ? (
            /* Folder actions */
            isStaged ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const files = collectFilesFromNode(node);
                  for (const file of files) {
                    onUnstage(file);
                  }
                }}
                className={cn(
                  "p-0.5 rounded",
                  isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                )}
                title="Unstage folder"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const files = collectFilesFromNode(node);
                  for (const file of files) {
                    onStage(file);
                  }
                }}
                className={cn(
                  "p-0.5 rounded",
                  isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                )}
                title="Stage folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )
          ) : node.change ? (
            /* File actions */
            <>
              {/* Show diff button */}
              <button
                onClick={handleDiffClick}
                className={cn(
                  "p-0.5 rounded",
                  isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                )}
                title="View diff"
              >
                <File className="w-3.5 h-3.5" />
              </button>

              {isStaged ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstage(node.change!);
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
                      onStage(node.change!);
                    }}
                    className={cn(
                      "p-0.5 rounded",
                      isDark ? "hover:bg-white/10" : "hover:bg-black/10"
                    )}
                    title="Stage"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {node.change.status !== "untracked" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDiscard(node.change!);
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
            </>
          ) : null}
        </div>
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isStaged={isStaged}
              expandedPaths={expandedPaths}
              onTogglePath={onTogglePath}
              onStage={onStage}
              onUnstage={onUnstage}
              onDiscard={onDiscard}
              onFileClick={onFileClick}
              onFileOpen={onFileOpen}
              selectedPath={selectedPath}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status?: GitFileStatus }) {
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
