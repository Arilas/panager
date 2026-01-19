/**
 * Persisted IDE State Hook
 *
 * Saves and restores IDE state (open files, sidebar width, etc.) to localStorage.
 */

import { useEffect, useRef, useCallback } from "react";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";
import { useEditorStore } from "../stores/editor";

const STORAGE_KEY_PREFIX = "ide-state-";
const DEBOUNCE_MS = 500;

interface PersistedState {
  openFilePaths: string[];
  activeFilePath: string | null;
  sidebarWidth: number;
  activePanel: "files" | "git" | "search" | "settings" | null;
  expandedPaths: string[];
}

export function usePersistedIdeState() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const activePanel = useIdeStore((s) => s.activePanel);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);

  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);
  const openFile = useFilesStore((s) => s.openFile);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // Get storage key for current project
  const storageKey = projectContext
    ? `${STORAGE_KEY_PREFIX}${projectContext.projectId}`
    : null;

  // Save state to localStorage (debounced)
  const saveState = useCallback(() => {
    if (!storageKey) return;

    const state: PersistedState = {
      openFilePaths: openTabs,
      activeFilePath: activeTabPath,
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
    activeTabPath,
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
    activeTabPath,
    sidebarWidth,
    activePanel,
    expandedPaths,
    saveState,
  ]);

  // Restore state from localStorage on mount
  useEffect(() => {
    if (!storageKey || hasRestoredRef.current) return;

    const restoreState = async () => {
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

        // Restore open files (with error handling for missing files)
        if (state.openFilePaths && state.openFilePaths.length > 0) {
          for (const filePath of state.openFilePaths) {
            try {
              await openFile(filePath);
            } catch (error) {
              console.warn(`Failed to restore file: ${filePath}`, error);
            }
          }

          // Restore active file
          if (state.activeFilePath) {
            setActiveTab(state.activeFilePath);
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
  }, [storageKey, setSidebarWidth, setActivePanel, openFile, setActiveTab]);

  // Clear state for a project
  const clearState = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return { clearState };
}
