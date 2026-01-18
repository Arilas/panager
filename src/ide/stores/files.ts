/**
 * File tree and open files state store
 */

import { create } from "zustand";
import type { FileEntry, OpenFile } from "../types";
import {
  readDirectory,
  readFile,
  writeFile,
  notifyFileClosed,
  notifyFileChanged,
} from "../lib/tauri-ide";

/** Position to navigate to when opening a file */
export interface FilePosition {
  line: number; // 1-indexed
  column: number; // 1-indexed
}

/** Pending navigation after file opens */
let pendingNavigation: { path: string; position: FilePosition } | null = null;

/** Get and clear pending navigation */
export function consumePendingNavigation(path: string): FilePosition | null {
  if (pendingNavigation && pendingNavigation.path === path) {
    const pos = pendingNavigation.position;
    pendingNavigation = null;
    return pos;
  }
  return null;
}

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
  openFilePreview: (path: string) => Promise<void>;
  openFileAtPosition: (path: string, position: FilePosition) => Promise<void>;
  closeFile: (path: string) => void;
  closeOtherFiles: (path: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (path: string | null) => void;
  convertPreviewToPermanent: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  saveAllFiles: () => Promise<void>;

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
    const existingIndex = openFiles.findIndex((f) => f.path === path);
    if (existingIndex >= 0) {
      const existing = openFiles[existingIndex];
      // If it was a preview, convert to permanent
      if (existing.isPreview) {
        set({
          openFiles: openFiles.map((f, i) =>
            i === existingIndex ? { ...f, isPreview: false } : f
          ),
          activeFilePath: path,
        });
      } else {
        set({ activeFilePath: path });
      }
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
        isPreview: false,
      };

      set({
        openFiles: [...openFiles, newFile],
        activeFilePath: path,
      });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },

  openFilePreview: async (path) => {
    const { openFiles } = get();

    // Check if file is already open
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      // If already permanent, just activate it
      // If it's already the preview tab, just activate it
      set({ activeFilePath: path });
      return;
    }

    try {
      const fileContent = await readFile(path);

      if (fileContent.isBinary) {
        console.warn("Cannot open binary file:", path);
        return;
      }

      const newFile: OpenFile = {
        path,
        content: fileContent.content,
        language: fileContent.language,
        isDirty: false,
        isPreview: true,
      };

      // Find and replace existing preview tab, or add new
      const existingPreviewIndex = openFiles.findIndex((f) => f.isPreview);

      let newOpenFiles: OpenFile[];
      if (existingPreviewIndex >= 0) {
        // Close the old preview (notify plugins)
        const oldPreview = openFiles[existingPreviewIndex];
        notifyFileClosed(oldPreview.path).catch(console.error);

        // Replace preview tab at same position
        newOpenFiles = [...openFiles];
        newOpenFiles[existingPreviewIndex] = newFile;
      } else {
        // Add new preview tab at the end
        newOpenFiles = [...openFiles, newFile];
      }

      set({
        openFiles: newOpenFiles,
        activeFilePath: path,
      });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },

  openFileAtPosition: async (path, position) => {
    const { openFiles, openFile } = get();

    // Store the pending navigation
    pendingNavigation = { path, position };

    // Check if already open
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      // File is already open, just set it active
      // The editor will pick up the pending navigation
      set({ activeFilePath: path });
      // Force a re-render by updating the file (this triggers the editor to check for navigation)
      set((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === path ? { ...f } : f
        ),
      }));
      return;
    }

    // Open the file - the editor will navigate when it mounts
    await openFile(path);
  },

  closeFile: (path) => {
    // Notify plugins about the file being closed
    notifyFileClosed(path).catch(console.error);

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

  convertPreviewToPermanent: (path) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path && f.isPreview ? { ...f, isPreview: false } : f
      ),
    }));
  },

  updateFileContent: (path, content) => {
    // Notify plugins about the content change
    notifyFileChanged(path, content).catch(console.error);

    // Auto-convert preview to permanent when editing
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true, isPreview: false } : f
      ),
    }));
  },

  saveFile: async (path) => {
    const { openFiles } = get();
    const file = openFiles.find((f) => f.path === path);
    if (!file) return;

    try {
      await writeFile(path, file.content);
      set((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === path ? { ...f, isDirty: false } : f
        ),
      }));
    } catch (error) {
      console.error("Failed to save file:", error);
      throw error;
    }
  },

  saveActiveFile: async () => {
    const { activeFilePath, saveFile } = get();
    if (activeFilePath) {
      await saveFile(activeFilePath);
    }
  },

  saveAllFiles: async () => {
    const { openFiles, saveFile } = get();
    const dirtyFiles = openFiles.filter((f) => f.isDirty);
    await Promise.all(dirtyFiles.map((f) => saveFile(f.path)));
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
