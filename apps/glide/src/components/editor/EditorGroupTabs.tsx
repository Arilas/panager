/**
 * Editor Group Tabs Component
 *
 * Tab bar for a single editor group.
 * Uses the new tabs store and EditorGroupTab component.
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTabsStore } from "../../stores/tabs";
import { useAgentStore } from "../../stores/agent";
import { useAcpEvents } from "../../hooks/useAcpEvents";
import { useGitStore } from "../../stores/git";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { TabGroupContextMenu } from "./TabGroupContextMenu";
import { EditorGroupTab } from "./EditorGroupTab";
import { cn } from "../../lib/utils";
import type { GitFileStatus } from "../../types";

interface EditorGroupTabsProps {
  groupId: string;
  isGroupActive: boolean;
}

/** Context menu state */
interface ContextMenuState {
  x: number;
  y: number;
  url: string;
  filePath: string | null;
  isPreview: boolean;
  isPinned: boolean;
}

export function EditorGroupTabs({ groupId, isGroupActive }: EditorGroupTabsProps) {
  // Tab store actions
  const groups = useTabsStore((s) => s.groups);
  const registry = useTabsStore((s) => s.registry);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const setActiveGroup = useTabsStore((s) => s.setActiveGroup);
  const closeTab = useTabsStore((s) => s.closeTab);
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs);
  const openTab = useTabsStore((s) => s.openTab);
  const pinTab = useTabsStore((s) => s.pinTab);
  const unpinTab = useTabsStore((s) => s.unpinTab);
  const reorderTabs = useTabsStore((s) => s.reorderTabs);
  const convertPreviewToPermanent = useTabsStore((s) => s.convertPreviewToPermanent);
  const createGroup = useTabsStore((s) => s.createGroup);

  // Other stores
  const projectContext = useIdeStore((s) => s.projectContext);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);
  const setRevealFilePath = useFilesStore((s) => s.setRevealFilePath);
  const gitChanges = useGitStore((s) => s.changes);

  // Theme
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();
  const isDark = effectiveTheme === "dark";

  // ACP/Agent hooks
  const { newSession, connect } = useAcpEvents();
  const status = useAgentStore((s) => s.status);

  // Find this group
  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const tabs = group?.tabs ?? [];
  const activeUrl = group?.activeUrl ?? null;

  // Refs for auto-scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (activeTabRef.current && isGroupActive) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeUrl, isGroupActive]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Drag and drop state
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<number | null>(null);

  // Build git status map
  const gitStatusMap = useMemo<Map<string, GitFileStatus>>(() => {
    const map = new Map<string, GitFileStatus>();
    const projectRoot = projectContext?.projectPath ?? "";
    for (const change of gitChanges) {
      const fullPath = projectRoot ? `${projectRoot}/${change.path}` : change.path;
      map.set(fullPath, change.status);
    }
    return map;
  }, [gitChanges, projectContext]);

  // Helper: Get file path from URL
  const getFilePath = (url: string): string | null => {
    if (!registry) return null;
    const resolver = registry.findResolver(url);
    return resolver?.toFilePath?.(url) ?? null;
  };

  // Helper: Get relative path
  const getRelativePath = (fullPath: string) => {
    if (!projectContext?.projectPath) return fullPath;
    const projectRoot = projectContext.projectPath;
    return fullPath.startsWith(projectRoot)
      ? fullPath.slice(projectRoot.length + 1)
      : fullPath;
  };

  // Handlers
  const handleOpenAITab = async () => {
    if (!projectContext?.projectPath) return;
    if (status === "disconnected") {
      await connect();
    }
    const sessionId = await newSession();
    if (sessionId) {
      await openTab({ url: "chat://new", isPreview: false, groupId });
    }
  };

  const handleSplitRight = async (url: string) => {
    const newGroupId = await createGroup();
    await openTab({ url, isPreview: false, groupId: newGroupId });
  };

  const revealInSidebar = (filePath: string) => {
    setActivePanel("files");
    setRevealFilePath(filePath);
  };

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
            const isActive = tab.url === activeUrl;
            const filePath = getFilePath(tab.url);
            const gitStatus = filePath ? gitStatusMap.get(filePath) : undefined;

            return (
              <EditorGroupTab
                key={tab.url}
                ref={isActive ? activeTabRef : null}
                tab={tab}
                tabIndex={tabIndex}
                isActive={isActive}
                isGroupActive={isGroupActive}
                isDragging={draggedTab === tab.url}
                showDropIndicator={dropIndicator === tabIndex}
                filePath={filePath}
                gitStatus={gitStatus}
                onDragStart={(e) => {
                  if (tab.isPreview) return;
                  setDraggedTab(tab.url);
                  e.dataTransfer.effectAllowed = "move";
                  if (e.currentTarget instanceof HTMLElement) {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                }}
                onDragOver={(e) => {
                  if (!draggedTab || tab.isPreview) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midpoint = rect.left + rect.width / 2;
                  setDropIndicator(e.clientX < midpoint ? tabIndex : tabIndex + 1);
                }}
                onDragLeave={() => setDropIndicator(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedTab || draggedTab === tab.url) return;
                  const fromIndex = tabs.findIndex((t) => t.url === draggedTab);
                  if (fromIndex === -1) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midpoint = rect.left + rect.width / 2;
                  let toIndex = e.clientX < midpoint ? tabIndex : tabIndex + 1;
                  if (fromIndex < toIndex) toIndex--;
                  if (fromIndex !== toIndex) {
                    reorderTabs(fromIndex, toIndex, groupId);
                  }
                }}
                onDragEnd={() => {
                  setDraggedTab(null);
                  setDropIndicator(null);
                }}
                onClick={() => {
                  if (!isGroupActive) setActiveGroup(groupId);
                  setActiveTab(tab.url, groupId);
                }}
                onDoubleClick={() => {
                  if (tab.isPreview) convertPreviewToPermanent(tab.url, groupId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    url: tab.url,
                    filePath,
                    isPreview: tab.isPreview,
                    isPinned: tab.isPinned,
                  });
                }}
                onClose={() => closeTab(tab.url, groupId)}
              />
            );
          })}
        </div>

        {/* AI Tab button */}
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
        <TabGroupContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabUrl={contextMenu.url}
          filePath={contextMenu.filePath}
          isPinned={contextMenu.isPinned}
          isPreview={contextMenu.isPreview}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => {
            closeTab(contextMenu.url, groupId);
            setContextMenu(null);
          }}
          onCloseOthers={() => {
            closeOtherTabs(contextMenu.url, groupId);
            setContextMenu(null);
          }}
          onCloseAll={() => {
            closeAllTabs(groupId);
            setContextMenu(null);
          }}
          onPin={() => {
            pinTab(contextMenu.url, groupId);
            setContextMenu(null);
          }}
          onUnpin={() => {
            unpinTab(contextMenu.url, groupId);
            setContextMenu(null);
          }}
          onCopyPath={() => {
            if (contextMenu.filePath) {
              navigator.clipboard.writeText(contextMenu.filePath);
            }
            setContextMenu(null);
          }}
          onCopyRelativePath={() => {
            if (contextMenu.filePath) {
              navigator.clipboard.writeText(getRelativePath(contextMenu.filePath));
            }
            setContextMenu(null);
          }}
          onRevealInSidebar={() => {
            if (contextMenu.filePath) {
              revealInSidebar(contextMenu.filePath);
            }
            setContextMenu(null);
          }}
          onSplitRight={() => {
            handleSplitRight(contextMenu.url);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}
