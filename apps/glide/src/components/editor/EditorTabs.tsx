/**
 * Editor Tabs Component
 *
 * Styled with theme support to match Panager's design.
 * Uses editorStore for tab state management.
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { X, File, Circle, GitCompareArrows, Sparkles, Pin, Loader2 } from "lucide-react";
import { useEditorStore, isFileTab, isDiffTab, isChatTab, isLazyTab, isLazyDiffTab, type TabState } from "../../stores/editor";
import { useAgentStore } from "../../stores/agent";
import { useAcpEvents } from "../../hooks/useAcpEvents";
import { useGitStore } from "../../stores/git";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { TabContextMenu } from "./TabContextMenu";
import { cn } from "../../lib/utils";
import type { GitFileStatus } from "../../types";

/** Tab data for rendering */
interface TabData {
  path: string;
  /** Actual file path (same as path for file tabs, original file for diff tabs) */
  filePath: string;
  isPreview: boolean;
  isDirty: boolean;
  isDiff: boolean;
  isChat: boolean;
  isLazy?: boolean;
  isPinned: boolean;
  fileName: string;
  staged?: boolean;
}

/** Context menu state */
interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  /** Actual file path (different from path for diff tabs) */
  filePath: string;
  isPreview: boolean;
  isPinned: boolean;
}

/** Get color class for git status */
function getGitStatusColor(
  status: GitFileStatus | undefined
): string | undefined {
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

/** Check if a tab state is dirty (only applicable to loaded file tabs) */
function isTabDirty(tabState: TabState): boolean {
  // Lazy tabs are never dirty (no content loaded yet)
  if (isLazyTab(tabState)) return false;
  if (!isFileTab(tabState)) return false;
  return tabState.content !== tabState.savedContent;
}

/** Get display name for a tab */
function getTabFileName(tabState: TabState, sessions?: Record<string, { name: string }>): string {
  // Lazy tabs have fileName stored directly
  if (isLazyTab(tabState)) {
    return tabState.fileName;
  }
  if (isDiffTab(tabState)) {
    return tabState.fileName;
  }
  if (isChatTab(tabState)) {
    // Prefer session name from agent store (may have been updated after first message)
    const sessionFromStore = sessions?.[tabState.sessionId];
    return sessionFromStore?.name || tabState.sessionName;
  }
  return tabState.path.split("/").pop() || tabState.path;
}

export function EditorTabs() {
  // Get tab state from editorStore
  const openTabs = useEditorStore((s) => s.openTabs);
  const tabStates = useEditorStore((s) => s.tabStates);
  const previewTab = useEditorStore((s) => s.previewTab);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const pinnedTabs = useEditorStore((s) => s.pinnedTabs);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs);
  const closeAllTabs = useEditorStore((s) => s.closeAllTabs);
  const openChatTab = useEditorStore((s) => s.openChatTab);
  const pinTab = useEditorStore((s) => s.pinTab);
  const unpinTab = useEditorStore((s) => s.unpinTab);
  const reorderTabs = useEditorStore((s) => s.reorderTabs);
  const convertPreviewToPermanent = useEditorStore(
    (s) => s.convertPreviewToPermanent
  );

  const projectContext = useIdeStore((s) => s.projectContext);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);
  const setRevealFilePath = useFilesStore((s) => s.setRevealFilePath);
  const gitChanges = useGitStore((s) => s.changes);
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  // ACP/Agent hooks for creating chat sessions
  const sessions = useAgentStore((s) => s.sessions);
  const { newSession, connect } = useAcpEvents();
  const status = useAgentStore((s) => s.status);

  const isDark = effectiveTheme === "dark";

  // Refs for auto-scroll to active tab
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeTabPath]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Drag and drop state
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<number | null>(null);

  // Handler to open a new AI chat tab
  const handleOpenAITab = async () => {
    if (!projectContext?.projectPath) return;

    // Connect if not connected
    if (status === "disconnected") {
      await connect();
    }

    // Create a new session via ACP backend
    const sessionId = await newSession();
    if (sessionId) {
      // Get the session from store to get the name
      const sessions = useAgentStore.getState().sessions;
      const session = sessions[sessionId];
      const sessionName = session?.name || "New Chat";

      // Open as a tab
      openChatTab(sessionId, sessionName);
    }
  };

  // Build tab list from permanent tabs + preview tab
  const tabs = useMemo<TabData[]>(() => {
    const result: TabData[] = [];

    // Helper to get the actual file path (for diff tabs, this is the original file)
    const getFilePath = (tabState: typeof tabStates[string]): string => {
      if (isDiffTab(tabState)) {
        return tabState.filePath;
      }
      if (isLazyDiffTab(tabState)) {
        return tabState.filePath;
      }
      if (isFileTab(tabState) || isLazyTab(tabState)) {
        return tabState.path;
      }
      return tabState.path; // For chat tabs, just use the path
    };

    // Helper to check if tab is a diff (including lazy diff)
    const isTabDiff = (tabState: typeof tabStates[string]): boolean => {
      return isDiffTab(tabState) || isLazyDiffTab(tabState);
    };

    // Helper to check if tab is lazy
    const isTabLazy = (tabState: typeof tabStates[string]): boolean => {
      return isLazyTab(tabState);
    };

    // Helper to get staged status
    const getStaged = (tabState: typeof tabStates[string]): boolean | undefined => {
      if (isDiffTab(tabState)) return tabState.staged;
      if (isLazyDiffTab(tabState)) return tabState.staged;
      return undefined;
    };

    // Add permanent tabs
    for (const path of openTabs) {
      const tabState = tabStates[path];
      if (tabState) {
        result.push({
          path,
          filePath: getFilePath(tabState),
          isPreview: false,
          isDirty: isTabDirty(tabState),
          isDiff: isTabDiff(tabState),
          isChat: isChatTab(tabState),
          isLazy: isTabLazy(tabState),
          isPinned: pinnedTabs.includes(path),
          fileName: getTabFileName(tabState, sessions),
          staged: getStaged(tabState),
        });
      }
    }

    // Add preview tab at the end (preview tabs cannot be lazy)
    if (previewTab) {
      result.push({
        path: previewTab.path,
        filePath: isDiffTab(previewTab) ? previewTab.filePath : previewTab.path,
        isPreview: true,
        isDirty: isTabDirty(previewTab),
        isDiff: isDiffTab(previewTab),
        isChat: isChatTab(previewTab),
        isLazy: false,
        isPinned: false,
        fileName: getTabFileName(previewTab, sessions),
        staged: isDiffTab(previewTab) ? previewTab.staged : undefined,
      });
    }

    return result;
  }, [openTabs, tabStates, previewTab, sessions, pinnedTabs]);

  // Reveal file in sidebar by triggering the reveal mechanism
  const revealInSidebar = (filePath: string) => {
    // Ensure the files panel is active
    setActivePanel("files");

    // Trigger reveal via the files store (handled by useRevealActiveFile hook)
    setRevealFilePath(filePath);
  };

  // Get relative path for copying
  const getRelativePath = (fullPath: string) => {
    if (!projectContext?.projectPath) return fullPath;
    const projectRoot = projectContext.projectPath;
    return fullPath.startsWith(projectRoot)
      ? fullPath.slice(projectRoot.length + 1)
      : fullPath;
  };

  // Build a map of file paths to their git status for quick lookup
  const gitStatusMap = useMemo<Map<string, GitFileStatus>>(() => {
    const map = new Map<string, GitFileStatus>();
    const projectRoot = projectContext?.projectPath ?? "";

    for (const change of gitChanges) {
      // Use the full path for matching (tabs use full paths)
      const fullPath = projectRoot
        ? `${projectRoot}/${change.path}`
        : change.path;
      map.set(fullPath, change.status);
    }
    return map;
  }, [gitChanges, projectContext]);

  return (
    <div
      className={cn(
        "relative shrink-0 h-[32px]",
        liquidGlass
          ? "bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5"
          : [
              isDark ? "bg-neutral-900/80" : "bg-neutral-100/80",
              "border-b border-black/5 dark:border-white/5",
            ]
      )}
    >
      <div className="absolute inset-0 flex items-center">
        {/* Scrollable tabs container */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto overflow-y-hidden tabs-scrollbar flex-1 min-w-0 items-center"
        >
          {tabs.map((tab, tabIndex) => {
            const isActive = tab.path === activeTabPath;
            const gitStatus = tab.isDiff ? undefined : gitStatusMap.get(tab.path);
            const gitStatusColor = getGitStatusColor(gitStatus);
            const isDragging = draggedTab === tab.path;
            const showDropIndicator = dropIndicator === tabIndex;

            return (
              <div
                key={tab.path}
                ref={isActive ? activeTabRef : undefined}
                draggable={!tab.isPreview}
                onDragStart={(e) => {
                  if (tab.isPreview) return;
                  setDraggedTab(tab.path);
                  e.dataTransfer.effectAllowed = "move";
                  // Make drag image semi-transparent
                  if (e.currentTarget instanceof HTMLElement) {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                }}
                onDragOver={(e) => {
                  if (!draggedTab || tab.isPreview) return;
                  e.preventDefault();
                  // Calculate if we're on the left or right half
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midpoint = rect.left + rect.width / 2;
                  const insertBefore = e.clientX < midpoint;
                  setDropIndicator(insertBefore ? tabIndex : tabIndex + 1);
                }}
                onDragLeave={() => {
                  setDropIndicator(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedTab || draggedTab === tab.path) return;

                  const fromIndex = tabs.findIndex((t) => t.path === draggedTab);
                  if (fromIndex === -1) return;

                  // Calculate target index
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midpoint = rect.left + rect.width / 2;
                  let toIndex = e.clientX < midpoint ? tabIndex : tabIndex + 1;

                  // Adjust if moving from before to after
                  if (fromIndex < toIndex) toIndex--;

                  if (fromIndex !== toIndex) {
                    reorderTabs(fromIndex, toIndex);
                  }
                }}
                onDragEnd={() => {
                  setDraggedTab(null);
                  setDropIndicator(null);
                }}
                onClick={() => setActiveTab(tab.path)}
                onDoubleClick={() => {
                  // Double-click on preview tab makes it permanent
                  if (tab.isPreview) {
                    convertPreviewToPermanent();
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    path: tab.path,
                    filePath: tab.filePath,
                    isPreview: tab.isPreview,
                    isPinned: tab.isPinned,
                  });
                }}
                title={tab.isDiff ? tab.filePath : tab.isChat ? `Chat: ${tab.fileName}` : tab.path}
                className={cn(
                  "group flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] cursor-pointer select-none",
                  "transition-colors min-w-[120px] max-w-[240px] shrink-0 relative",
                  "border-r border-black/5 dark:border-white/5",
                  isActive
                    ? [
                        liquidGlass
                          ? "bg-white/10 dark:bg-white/10"
                          : isDark
                            ? "bg-neutral-800/50"
                            : "bg-white/80",
                        isDark ? "text-neutral-100" : "text-neutral-900",
                      ]
                    : [
                        "bg-transparent",
                        isDark
                          ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                          : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                      ],
                  isDragging && "opacity-50",
                  tab.isPinned && "border-r-2 border-r-violet-500/30"
                )}
              >
                {/* Drop indicator */}
                {showDropIndicator && (
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-violet-500 rounded-full" />
                )}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Show loading spinner for active lazy tab */}
                  {tab.isLazy && isActive ? (
                    <Loader2
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 animate-spin",
                        isDark ? "text-neutral-400" : "text-neutral-500"
                      )}
                    />
                  ) : tab.isPinned ? (
                    <Pin
                      className={cn(
                        "w-3 h-3 shrink-0",
                        isDark ? "text-violet-400" : "text-violet-500"
                      )}
                    />
                  ) : tab.isDiff ? (
                    <GitCompareArrows
                      className={cn("w-3.5 h-3.5 shrink-0 text-blue-500")}
                    />
                  ) : tab.isChat ? (
                    <Sparkles
                      className={cn("w-3.5 h-3.5 shrink-0 text-violet-500")}
                    />
                  ) : (
                    <File
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 opacity-60",
                        gitStatusColor
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "truncate min-w-0",
                      tab.isPreview && "italic",
                      !tab.isDiff && gitStatusColor
                    )}
                  >
                    {tab.fileName}
                    {tab.isDiff && (
                      <span className="text-neutral-500 ml-1">
                        ({tab.staged ? "Staged" : "Changes"})
                      </span>
                    )}
                  </span>
                </div>
                {/* Close button or dirty indicator */}
                {/* For pinned tabs: only show dirty indicator (no close button) */}
                {tab.isPinned ? (
                  tab.isDirty && (
                    <Circle
                      className={cn(
                        "w-2.5 h-2.5 fill-current shrink-0",
                        isDark ? "text-neutral-400" : "text-neutral-500"
                      )}
                    />
                  )
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className={cn(
                      "p-0.5 rounded transition-colors shrink-0 relative",
                      isDark ? "hover:bg-white/10" : "hover:bg-black/10",
                      // Show X on hover, always show dirty indicator
                      tab.isDirty
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                      isActive && "opacity-100"
                    )}
                  >
                    {/* Dirty indicator (dot) - hidden on hover */}
                    {tab.isDirty && (
                      <Circle
                        className={cn(
                          "w-2.5 h-2.5 fill-current group-hover:hidden",
                          isDark ? "text-neutral-400" : "text-neutral-500"
                        )}
                      />
                    )}
                    {/* Close X - shown on hover or when not dirty */}
                    <X
                      className={cn(
                        "w-3 h-3",
                        tab.isDirty ? "hidden group-hover:block" : ""
                      )}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Tab button - sticky outside scrollable area */}
        <button
          onClick={handleOpenAITab}
          className={cn(
            "flex items-center justify-center px-2 py-1.5 shrink-0",
            "transition-colors border-l border-black/5 dark:border-white/5",
            isDark
              ? "text-neutral-400 hover:text-violet-400 hover:bg-white/5"
              : "text-neutral-500 hover:text-violet-600 hover:bg-black/5"
          )}
          title="Open AI Tab"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabPath={contextMenu.path}
          isPinned={contextMenu.isPinned}
          isPreview={contextMenu.isPreview}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => {
            closeTab(contextMenu.path);
            setContextMenu(null);
          }}
          onCloseOthers={() => {
            closeOtherTabs(contextMenu.path);
            setContextMenu(null);
          }}
          onCloseAll={() => {
            closeAllTabs();
            setContextMenu(null);
          }}
          onPin={() => {
            pinTab(contextMenu.path);
            setContextMenu(null);
          }}
          onUnpin={() => {
            unpinTab(contextMenu.path);
            setContextMenu(null);
          }}
          onCopyPath={() => {
            navigator.clipboard.writeText(contextMenu.filePath);
            setContextMenu(null);
          }}
          onCopyRelativePath={() => {
            navigator.clipboard.writeText(getRelativePath(contextMenu.filePath));
            setContextMenu(null);
          }}
          onRevealInSidebar={() => {
            revealInSidebar(contextMenu.filePath);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}
