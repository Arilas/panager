/**
 * File tree and open files state store
 */

import { create } from "zustand";
import type { FileEntry, OpenFile } from "../types";
import { readDirectory, readFile } from "../lib/tauri-ide";

interface FilesState {
  // File tree
  tree: FileEntry[];
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  treeLoading: boolean;
  treeError: string | null;

  // Open files
  openFiles: OpenFile[];
  activeFilePath: string | null;

  // Actions
  loadFileTree: (rootPath: string) => Promise<void>;
  expandDirectory: (path: string, projectPath: string) => Promise<void>;
  collapseDirectory: (path: string) => void;
  toggleDirectory: (path: string, projectPath: string) => Promise<void>;

  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  closeOtherFiles: (path: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (path: string | null) => void;

  // File tree updates from watcher
  addFileToTree: (path: string, isDirectory: boolean) => void;
  removeFileFromTree: (path: string) => void;
  updateFileTree: () => Promise<void>;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  // Initial state
  tree: [],
  expandedPaths: new Set(),
  loadingPaths: new Set(),
  treeLoading: false,
  treeError: null,
  openFiles: [],
  activeFilePath: null,

  // Actions
  loadFileTree: async (rootPath) => {
    set({ treeLoading: true, treeError: null });
    try {
      const entries = await readDirectory(rootPath, 1, false);
      set({ tree: entries, treeLoading: false });
    } catch (error) {
      set({
        treeError: error instanceof Error ? error.message : String(error),
        treeLoading: false,
      });
    }
  },

  expandDirectory: async (path, _projectPath) => {
    const { loadingPaths } = get();

    if (loadingPaths.has(path)) return;

    set({ loadingPaths: new Set([...loadingPaths, path]) });

    try {
      const entries = await readDirectory(path, 1, false);

      // Update tree with new children
      set((state) => {
        const newTree = updateTreeChildren(state.tree, path, entries);
        const newExpanded = new Set(state.expandedPaths);
        newExpanded.add(path);
        const newLoading = new Set(state.loadingPaths);
        newLoading.delete(path);

        return {
          tree: newTree,
          expandedPaths: newExpanded,
          loadingPaths: newLoading,
        };
      });
    } catch (error) {
      set((state) => {
        const newLoading = new Set(state.loadingPaths);
        newLoading.delete(path);
        return { loadingPaths: newLoading };
      });
      console.error("Failed to expand directory:", error);
    }
  },

  collapseDirectory: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.delete(path);
      return { expandedPaths: newExpanded };
    });
  },

  toggleDirectory: async (path, projectPath) => {
    const { expandedPaths, expandDirectory, collapseDirectory } = get();
    if (expandedPaths.has(path)) {
      collapseDirectory(path);
    } else {
      await expandDirectory(path, projectPath);
    }
  },

  openFile: async (path) => {
    const { openFiles } = get();

    // Check if already open
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }

    try {
      const fileContent = await readFile(path);

      if (fileContent.isBinary) {
        // Don't open binary files
        console.warn("Cannot open binary file:", path);
        return;
      }

      const newFile: OpenFile = {
        path,
        content: fileContent.content,
        language: fileContent.language,
        isDirty: false,
      };

      set({
        openFiles: [...openFiles, newFile],
        activeFilePath: path,
      });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },

  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f.path !== path);
      let newActivePath = state.activeFilePath;

      if (state.activeFilePath === path) {
        // Select the previous or next file
        const index = state.openFiles.findIndex((f) => f.path === path);
        if (newOpenFiles.length > 0) {
          newActivePath =
            newOpenFiles[Math.min(index, newOpenFiles.length - 1)]?.path ??
            null;
        } else {
          newActivePath = null;
        }
      }

      return {
        openFiles: newOpenFiles,
        activeFilePath: newActivePath,
      };
    });
  },

  closeOtherFiles: (path) => {
    set((state) => ({
      openFiles: state.openFiles.filter((f) => f.path === path),
      activeFilePath: path,
    }));
  },

  closeAllFiles: () => {
    set({ openFiles: [], activeFilePath: null });
  },

  setActiveFile: (path) => {
    set({ activeFilePath: path });
  },

  // File tree updates
  addFileToTree: (_path, _isDirectory) => {
    // Trigger a refresh of the parent directory
    // This is a simplified implementation
    set((state) => ({ tree: state.tree })); // Force re-render
  },

  removeFileFromTree: (path) => {
    set((state) => {
      // Remove from open files if open
      const newOpenFiles = state.openFiles.filter((f) => f.path !== path);
      let newActivePath = state.activeFilePath;
      if (state.activeFilePath === path) {
        newActivePath = newOpenFiles[0]?.path ?? null;
      }

      return {
        openFiles: newOpenFiles,
        activeFilePath: newActivePath,
      };
    });
  },

  updateFileTree: async () => {
    // Will be called after file watcher events
    // Re-load the root and any expanded directories
  },
}));

// Helper to update children of a directory in the tree
function updateTreeChildren(
  tree: FileEntry[],
  path: string,
  children: FileEntry[]
): FileEntry[] {
  return tree.map((entry) => {
    if (entry.path === path) {
      return { ...entry, children };
    }
    if (entry.children) {
      return {
        ...entry,
        children: updateTreeChildren(entry.children, path, children),
      };
    }
    return entry;
  });
}
