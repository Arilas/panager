/**
 * File tree and file I/O store
 *
 * Handles:
 * - File tree navigation (expand/collapse directories)
 * - File I/O operations (read/write files)
 *
 * NOTE: Open tabs and active file state are managed by editorStore.
 * This store only handles file tree and I/O, then delegates to editorStore.
 */

import { create } from "zustand";
import type { FileEntry } from "../types";
import { readDirectory, readFile, writeFile } from "../lib/tauri-ide";
import { useEditorStore } from "./editor";

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

  // Tree actions
  loadFileTree: (rootPath: string) => Promise<void>;
  expandDirectory: (path: string, projectPath: string) => Promise<void>;
  collapseDirectory: (path: string) => void;
  toggleDirectory: (path: string, projectPath: string) => Promise<void>;

  // File I/O actions (delegate to editorStore for tab management)
  openFile: (path: string) => Promise<void>;
  openFilePreview: (path: string) => Promise<void>;
  openFileAtPosition: (path: string, position: FilePosition) => Promise<void>;
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

  // ============================================================
  // Tree Actions
  // ============================================================

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

  // ============================================================
  // File I/O Actions
  // ============================================================

  openFile: async (path) => {
    const editorStore = useEditorStore.getState();

    // Check if already open in editor store
    const existingState = editorStore.getFileState(path);
    if (existingState) {
      // File is already open - just activate it
      // If it's a preview, convert to permanent
      if (editorStore.previewTab?.path === path) {
        editorStore.convertPreviewToPermanent();
      }
      editorStore.setActiveTab(path);
      return;
    }

    try {
      const fileContent = await readFile(path);

      if (fileContent.isBinary) {
        console.warn("Cannot open binary file:", path);
        return;
      }

      // Open as permanent tab in editor store
      editorStore.openTab(
        path,
        fileContent.content,
        fileContent.language,
        false
      );
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },

  openFilePreview: async (path) => {
    const editorStore = useEditorStore.getState();

    // Check if already open in editor store
    const existingState = editorStore.getFileState(path);
    if (existingState) {
      // File is already open - just activate it
      editorStore.setActiveTab(path);
      return;
    }

    try {
      const fileContent = await readFile(path);

      if (fileContent.isBinary) {
        console.warn("Cannot open binary file:", path);
        return;
      }

      // Open as preview tab in editor store
      editorStore.openTab(
        path,
        fileContent.content,
        fileContent.language,
        true
      );
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },

  openFileAtPosition: async (path, position) => {
    const { openFile } = get();
    const editorStore = useEditorStore.getState();

    // Store the pending navigation
    pendingNavigation = { path, position };

    // Check if already open
    const existingState = editorStore.getFileState(path);
    if (existingState) {
      // File is already open, just activate it
      // The editor will pick up the pending navigation
      editorStore.setActiveTab(path);
      return;
    }

    // Open the file - the editor will navigate when it mounts
    await openFile(path);
  },

  saveFile: async (path) => {
    const editorStore = useEditorStore.getState();
    const fileState = editorStore.getFileState(path);
    if (!fileState) return;

    try {
      await writeFile(path, fileState.content);
      editorStore.markSaved(path, fileState.content);
    } catch (error) {
      console.error("Failed to save file:", error);
      throw error;
    }
  },

  saveActiveFile: async () => {
    const { saveFile } = get();
    const activeTabPath = useEditorStore.getState().activeTabPath;
    if (activeTabPath) {
      await saveFile(activeTabPath);
    }
  },

  saveAllFiles: async () => {
    const { saveFile } = get();
    const editorStore = useEditorStore.getState();

    // Get all dirty files
    const dirtyPaths: string[] = [];
    for (const path of editorStore.openTabs) {
      const fileState = editorStore.fileStates[path];
      if (fileState && fileState.content !== fileState.savedContent) {
        dirtyPaths.push(path);
      }
    }
    // Also check preview tab
    if (
      editorStore.previewTab &&
      editorStore.previewTab.content !== editorStore.previewTab.savedContent
    ) {
      dirtyPaths.push(editorStore.previewTab.path);
    }

    await Promise.all(dirtyPaths.map((path) => saveFile(path)));
  },

  // ============================================================
  // File Tree Updates
  // ============================================================

  addFileToTree: (_path, _isDirectory) => {
    // Trigger a refresh of the parent directory
    // This is a simplified implementation
    set((state) => ({ tree: state.tree })); // Force re-render
  },

  removeFileFromTree: (path) => {
    // Close the file in editor store if it's open
    const editorStore = useEditorStore.getState();
    if (editorStore.getFileState(path)) {
      editorStore.closeTab(path);
    }
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
