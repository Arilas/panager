/**
 * Editor Tabs Component
 *
 * Styled with theme support to match Panager's design.
 * Uses editorStore for tab state management.
 */

import { useMemo } from "react";
import { X, File, Circle, GitCompareArrows, Sparkles } from "lucide-react";
import { useEditorStore, isFileTab, isDiffTab, isChatTab, type TabState } from "../../stores/editor";
import { useAgentStore } from "../../stores/agent";
import { useAcpEvents } from "../../hooks/useAcpEvents";
import { useGitStore } from "../../stores/git";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { GitFileStatus } from "../../types";

/** Tab data for rendering */
interface TabData {
  path: string;
  isPreview: boolean;
  isDirty: boolean;
  isDiff: boolean;
  isChat: boolean;
  fileName: string;
  staged?: boolean;
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

/** Check if a tab state is dirty (only applicable to file tabs) */
function isTabDirty(tabState: TabState): boolean {
  if (!isFileTab(tabState)) return false;
  return tabState.content !== tabState.savedContent;
}

/** Get display name for a tab */
function getTabFileName(tabState: TabState, sessions?: Record<string, { name: string }>): string {
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
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const openChatTab = useEditorStore((s) => s.openChatTab);
  const convertPreviewToPermanent = useEditorStore(
    (s) => s.convertPreviewToPermanent
  );

  const projectContext = useIdeStore((s) => s.projectContext);
  const gitChanges = useGitStore((s) => s.changes);
  const { effectiveTheme, useLiquidGlass } = useIdeSettingsContext();

  // ACP/Agent hooks for creating chat sessions
  const sessions = useAgentStore((s) => s.sessions);
  const { newSession, connect } = useAcpEvents();
  const status = useAgentStore((s) => s.status);

  const isDark = effectiveTheme === "dark";

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

    // Add permanent tabs
    for (const path of openTabs) {
      const tabState = tabStates[path];
      if (tabState) {
        result.push({
          path,
          isPreview: false,
          isDirty: isTabDirty(tabState),
          isDiff: isDiffTab(tabState),
          isChat: isChatTab(tabState),
          fileName: getTabFileName(tabState, sessions),
          staged: isDiffTab(tabState) ? tabState.staged : undefined,
        });
      }
    }

    // Add preview tab at the end
    if (previewTab) {
      result.push({
        path: previewTab.path,
        isPreview: true,
        isDirty: isTabDirty(previewTab),
        isDiff: isDiffTab(previewTab),
        isChat: isChatTab(previewTab),
        fileName: getTabFileName(previewTab, sessions),
        staged: isDiffTab(previewTab) ? previewTab.staged : undefined,
      });
    }

    return result;
  }, [openTabs, tabStates, previewTab, sessions]);

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
        useLiquidGlass
          ? "bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5"
          : [
              isDark ? "bg-neutral-900/80" : "bg-neutral-100/80",
              "border-b border-black/5 dark:border-white/5",
            ]
      )}
    >
      <div className="absolute inset-0 flex overflow-x-auto overflow-y-hidden tabs-scrollbar items-center">
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          const gitStatus = tab.isDiff ? undefined : gitStatusMap.get(tab.path);
          const gitStatusColor = getGitStatusColor(gitStatus);

          return (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              onDoubleClick={() => {
                // Double-click on preview tab makes it permanent
                if (tab.isPreview) {
                  convertPreviewToPermanent();
                }
              }}
              className={cn(
                "group flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] cursor-pointer",
                "transition-colors min-w-[120px] max-w-[240px] shrink-0",
                "border-r border-black/5 dark:border-white/5",
                isActive
                  ? [
                      useLiquidGlass
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
                    ]
              )}
            >
              <div className="flex items-center gap-2">
                {tab.isDiff ? (
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
                    "truncate",
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
                className={cn(
                  "p-0.5 rounded transition-colors shrink-0 relative",
                  isDark ? "hover:bg-white/10" : "hover:bg-black/10",
                  // Show X on hover for dirty files, always show dirty indicator otherwise
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
            </div>
          );
        })}

        {/* AI Tab button */}
        <button
          onClick={handleOpenAITab}
          className={cn(
            "flex items-center justify-center px-2 py-1.5 shrink-0 ml-auto",
            "transition-colors",
            isDark
              ? "text-neutral-400 hover:text-violet-400 hover:bg-white/5"
              : "text-neutral-500 hover:text-violet-600 hover:bg-black/5"
          )}
          title="Open AI Tab"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
