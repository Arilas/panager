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
import { useEditorStore, isFileTab } from "./editor";
import { useIdeStore } from "./ide";
import { useIdeSettingsStore } from "./settings";

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

    // Get project context and settings for format-on-save
    const projectContext = useIdeStore.getState().projectContext;
    const settingsStore = useIdeSettingsStore.getState();
    const formatOnSaveEnabled = settingsStore.settings.behavior.formatOnSave.enabled;

    try {
      const result = await writeFile(path, fileState.content, {
        runFormatters: formatOnSaveEnabled,
        projectPath: projectContext?.projectPath,
        scopeDefaultFolder: settingsStore.scopeDefaultFolder,
      });

      // If formatters ran and returned updated content, use that
      const savedContent = result.content ?? fileState.content;
      editorStore.markSaved(path, savedContent);

      // If content was modified by formatters, update the editor
      if (result.content && result.content !== fileState.content) {
        editorStore.updateContent(path, result.content);
      }
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

    // Get all dirty file tabs (only file tabs can be dirty, not diff tabs)
    const dirtyPaths: string[] = [];
    for (const path of editorStore.openTabs) {
      const tabState = editorStore.tabStates[path];
      if (tabState && isFileTab(tabState) && tabState.content !== tabState.savedContent) {
        dirtyPaths.push(path);
      }
    }
    // Also check preview tab (only if it's a file tab)
    if (
      editorStore.previewTab &&
      isFileTab(editorStore.previewTab) &&
      editorStore.previewTab.content !== editorStore.previewTab.savedContent
    ) {
      dirtyPaths.push(editorStore.previewTab.path);
    }

    await Promise.all(dirtyPaths.map((path) => saveFile(path)));
  },

  // ============================================================
  // File Tree Updates
  // ============================================================

  addFileToTree: (path, isDirectory) => {
    set((state) => {
      const parentPath = path.substring(0, path.lastIndexOf("/"));
      const fileName = path.substring(path.lastIndexOf("/") + 1);

      // Create the new entry
      const newEntry: FileEntry = {
        name: fileName,
        path,
        isDirectory,
        isHidden: fileName.startsWith("."),
        isGitignored: false, // Will be updated on next tree load
        extension: isDirectory ? undefined : fileName.split(".").pop(),
        children: isDirectory ? undefined : undefined,
      };

      // Add to parent's children
      const newTree = addEntryToTree(state.tree, parentPath, newEntry);
      return { tree: newTree };
    });
  },

  removeFileFromTree: (path) => {
    // Close the file in editor store if it's open
    const editorStore = useEditorStore.getState();
    if (editorStore.getFileState(path)) {
      editorStore.closeTab(path);
    }

    // Remove from tree
    set((state) => {
      const newTree = removeEntryFromTree(state.tree, path);
      // Also remove from expanded paths if it was a directory
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.delete(path);
      // Remove any expanded paths that are children of this path
      for (const expandedPath of state.expandedPaths) {
        if (expandedPath.startsWith(path + "/")) {
          newExpanded.delete(expandedPath);
        }
      }
      return { tree: newTree, expandedPaths: newExpanded };
    });
  },

  updateFileTree: async () => {
    // Re-load only the root level, preserving expanded directories
    const projectContext = useIdeStore.getState().projectContext;
    if (!projectContext) return;

    const { expandedPaths } = get();

    try {
      // Load root entries
      const entries = await readDirectory(projectContext.projectPath, 1, false);

      // For each expanded directory, reload its children
      const loadExpandedChildren = async (
        treeEntries: FileEntry[]
      ): Promise<FileEntry[]> => {
        const result: FileEntry[] = [];
        for (const entry of treeEntries) {
          if (entry.isDirectory && expandedPaths.has(entry.path)) {
            try {
              const children = await readDirectory(entry.path, 1, false);
              const loadedChildren = await loadExpandedChildren(children);
              result.push({ ...entry, children: loadedChildren });
            } catch {
              // If we can't load children, just include the entry without children
              result.push({ ...entry, children: undefined });
            }
          } else {
            result.push(entry);
          }
        }
        return result;
      };

      const treeWithChildren = await loadExpandedChildren(entries);
      set({ tree: treeWithChildren });
    } catch (error) {
      console.error("Failed to update file tree:", error);
    }
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

// Helper to add an entry to the tree under a parent path
function addEntryToTree(
  tree: FileEntry[],
  parentPath: string,
  newEntry: FileEntry
): FileEntry[] {
  return tree.map((entry) => {
    if (entry.path === parentPath && entry.isDirectory) {
      // Found the parent - add the new entry to its children
      const existingChildren = entry.children || [];
      // Check if entry already exists (avoid duplicates)
      if (existingChildren.some((child) => child.path === newEntry.path)) {
        return entry;
      }
      // Add and sort: directories first, then alphabetically
      const newChildren = [...existingChildren, newEntry].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      return { ...entry, children: newChildren };
    }
    if (entry.children) {
      return {
        ...entry,
        children: addEntryToTree(entry.children, parentPath, newEntry),
      };
    }
    return entry;
  });
}

// Helper to remove an entry from the tree
function removeEntryFromTree(tree: FileEntry[], path: string): FileEntry[] {
  return tree
    .filter((entry) => entry.path !== path)
    .map((entry) => {
      if (entry.children) {
        return {
          ...entry,
          children: removeEntryFromTree(entry.children, path),
        };
      }
      return entry;
    });
}
