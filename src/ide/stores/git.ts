/**
 * Git state store for IDE
 */

import { create } from "zustand";
import type { GitFileChange, GitBranchInfo, FileDiff } from "../types";
import { getGitChanges, getGitBranch, getFileDiff } from "../lib/tauri-ide";

interface GitState {
  // Git status
  changes: GitFileChange[];
  branch: GitBranchInfo | null;
  loading: boolean;
  error: string | null;

  // Diff view
  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  diff: FileDiff | null;
  diffLoading: boolean;

  // Actions
  loadGitStatus: (projectPath: string) => Promise<void>;
  selectFileForDiff: (
    projectPath: string,
    filePath: string,
    staged: boolean
  ) => Promise<void>;
  clearDiff: () => void;
  refresh: (projectPath: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  // Initial state
  changes: [],
  branch: null,
  loading: false,
  error: null,
  selectedFilePath: null,
  selectedFileStaged: false,
  diff: null,
  diffLoading: false,

  // Actions
  loadGitStatus: async (projectPath) => {
    set({ loading: true, error: null });
    try {
      const [changes, branch] = await Promise.all([
        getGitChanges(projectPath),
        getGitBranch(projectPath),
      ]);
      set({ changes, branch, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
    }
  },

  selectFileForDiff: async (projectPath, filePath, staged) => {
    set({
      selectedFilePath: filePath,
      selectedFileStaged: staged,
      diffLoading: true,
    });
    try {
      const diff = await getFileDiff(projectPath, filePath, staged);
      set({ diff, diffLoading: false });
    } catch (error) {
      console.error("Failed to load diff:", error);
      set({ diff: null, diffLoading: false });
    }
  },

  clearDiff: () => {
    set({
      selectedFilePath: null,
      selectedFileStaged: false,
      diff: null,
    });
  },

  refresh: async (projectPath) => {
    const { loadGitStatus, selectedFilePath, selectedFileStaged } = get();
    await loadGitStatus(projectPath);

    // Refresh diff if one was selected
    if (selectedFilePath) {
      const { changes } = get();
      const fileStillChanged = changes.some(
        (c) => c.path === selectedFilePath && c.staged === selectedFileStaged
      );
      if (!fileStillChanged) {
        set({ selectedFilePath: null, diff: null });
      }
    }
  },
}));
