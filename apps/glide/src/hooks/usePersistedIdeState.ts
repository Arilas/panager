/**
 * Persisted IDE State Hook
 *
 * Saves and restores IDE state (open files, sidebar width, etc.) to localStorage.
 */

import { useEffect, useRef, useCallback } from "react";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";
import {
  useEditorStore,
  isFileTab,
  isDiffTab,
  isLazyTab,
  type TabState,
} from "../stores/editor";

const STORAGE_KEY_PREFIX = "ide-state-";
const DEBOUNCE_MS = 500;

/** Persisted metadata for a tab */
interface PersistedTab {
  path: string;
  type: "file" | "diff";
  fileName: string;
  // Diff-specific fields
  filePath?: string;
  staged?: boolean;
}

interface PersistedState {
  /** Tab metadata for lazy restoration */
  tabs: PersistedTab[];
  activeFilePath: string | null;
  pinnedTabs: string[];
  sidebarWidth: number;
  activePanel: "files" | "git" | "search" | "settings" | null;
  expandedPaths: string[];
}

/** Convert tab state to persisted format */
function tabToPersistedTab(path: string, tabState: TabState | null): PersistedTab | null {
  if (!tabState) return null;

  if (isFileTab(tabState) || (isLazyTab(tabState) && tabState.targetType === "file")) {
    const fileName = path.split("/").pop() ?? path;
    return { path, type: "file", fileName };
  }

  if (isDiffTab(tabState)) {
    return {
      path,
      type: "diff",
      fileName: tabState.fileName,
      filePath: tabState.filePath,
      staged: tabState.staged,
    };
  }

  if (isLazyTab(tabState) && tabState.targetType === "diff") {
    return {
      path,
      type: "diff",
      fileName: tabState.fileName,
      filePath: tabState.filePath,
      staged: tabState.staged,
    };
  }

  // Chat tabs are not persisted
  return null;
}

export function usePersistedIdeState() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const activePanel = useIdeStore((s) => s.activePanel);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);

  const openTabs = useEditorStore((s) => s.openTabs);
  const tabStates = useEditorStore((s) => s.tabStates);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const pinnedTabs = useEditorStore((s) => s.pinnedTabs);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setPinnedTabs = useEditorStore((s) => s.setPinnedTabs);
  const registerLazyFileTab = useEditorStore((s) => s.registerLazyFileTab);
  const registerLazyDiffTab = useEditorStore((s) => s.registerLazyDiffTab);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // Get storage key for current project
  const storageKey = projectContext
    ? `${STORAGE_KEY_PREFIX}${projectContext.projectId}`
    : null;

  // Save state to localStorage (debounced)
  const saveState = useCallback(() => {
    if (!storageKey) return;

    // Convert open tabs to persisted format
    const tabs: PersistedTab[] = [];
    for (const path of openTabs) {
      const tabState = tabStates[path] ?? null;
      const persistedTab = tabToPersistedTab(path, tabState);
      if (persistedTab) {
        tabs.push(persistedTab);
      }
    }

    const state: PersistedState = {
      tabs,
      activeFilePath: activeTabPath,
      pinnedTabs,
      sidebarWidth,
      activePanel,
      expandedPaths: Array.from(expandedPaths),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to save IDE state:", error);
    }
  }, [
    storageKey,
    openTabs,
    tabStates,
    activeTabPath,
    pinnedTabs,
    sidebarWidth,
    activePanel,
    expandedPaths,
  ]);

  // Debounced save
  useEffect(() => {
    if (!storageKey || !hasRestoredRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(saveState, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    storageKey,
    openTabs,
    tabStates,
    activeTabPath,
    pinnedTabs,
    sidebarWidth,
    activePanel,
    expandedPaths,
    saveState,
  ]);

  // Restore state from localStorage on mount
  useEffect(() => {
    if (!storageKey || hasRestoredRef.current) return;

    const restoreState = () => {
      try {
        const savedState = localStorage.getItem(storageKey);
        if (!savedState) {
          hasRestoredRef.current = true;
          return;
        }

        const state: PersistedState = JSON.parse(savedState);

        // Restore sidebar width
        if (state.sidebarWidth) {
          setSidebarWidth(state.sidebarWidth);
        }

        // Restore active panel
        if (state.activePanel) {
          setActivePanel(state.activePanel);
        }

        // Register all tabs as lazy tabs (instant, no content loading)
        if (state.tabs && state.tabs.length > 0) {
          for (const tab of state.tabs) {
            if (tab.type === "file") {
              registerLazyFileTab(tab.path, tab.fileName);
            } else if (tab.type === "diff" && tab.filePath !== undefined && tab.staged !== undefined) {
              registerLazyDiffTab(tab.path, tab.fileName, tab.filePath, tab.staged);
            }
          }

          // Restore pinned tabs (filter to only include tabs that were restored)
          if (state.pinnedTabs && state.pinnedTabs.length > 0) {
            const restoredPaths = new Set(state.tabs.map((t) => t.path));
            const validPinnedTabs = state.pinnedTabs.filter((p) => restoredPaths.has(p));
            if (validPinnedTabs.length > 0) {
              setPinnedTabs(validPinnedTabs);
            }
          }

          // Set the active tab (content will be lazy-loaded by ContentArea)
          const activeFile = state.activeFilePath;
          const tabPaths = state.tabs.map((t) => t.path);
          if (activeFile && tabPaths.includes(activeFile)) {
            setActiveTab(activeFile, false); // Don't push to history
          } else if (tabPaths.length > 0) {
            setActiveTab(tabPaths[0], false);
          }
        }

        hasRestoredRef.current = true;
      } catch (error) {
        console.warn("Failed to restore IDE state:", error);
        hasRestoredRef.current = true;
      }
    };

    // Small delay to ensure stores are initialized
    const timer = setTimeout(restoreState, 100);

    return () => clearTimeout(timer);
  }, [storageKey, setSidebarWidth, setActivePanel, setPinnedTabs, setActiveTab, registerLazyFileTab, registerLazyDiffTab]);

  // Clear state for a project
  const clearState = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return { clearState };
}
