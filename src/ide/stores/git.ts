/**
 * Git state store for IDE
 */

import { create } from "zustand";
import type {
  GitFileChange,
  GitBranchInfo,
  FileDiff,
  GitLocalBranch,
  GitStashEntry,
  GitBlameResult,
  GitBlameLine,
  GitCommitInfo,
} from "../types";
import {
  getGitChanges,
  getGitBranch,
  getFileDiff,
  gitCommit,
  gitListBranches,
  gitCreateBranch,
  gitSwitchBranch,
  gitDeleteBranch,
  gitCheckUncommittedChanges,
  gitStashSave,
  gitStashList,
  gitStashPop,
  gitStashApply,
  gitStashDrop,
  gitBlame,
  gitShowHead,
} from "../lib/tauri-ide";

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

  // Commit state
  commitMessage: string;
  commitAmend: boolean;
  commitLoading: boolean;

  // Branch state
  branches: GitLocalBranch[];
  branchesLoading: boolean;

  // Stash state
  stashes: GitStashEntry[];
  stashesLoading: boolean;

  // Blame cache (per file path)
  blameCache: Record<string, GitBlameResult>;
  blameLoading: Record<string, boolean>;

  // HEAD content cache (for gutter diff - separate from blame)
  headContent: Record<string, string>;
  headContentLoading: Record<string, boolean>;

  // Actions - Status
  loadGitStatus: (projectPath: string) => Promise<void>;
  selectFileForDiff: (
    projectPath: string,
    filePath: string,
    staged: boolean
  ) => Promise<void>;
  clearDiff: () => void;
  refresh: (projectPath: string) => Promise<void>;

  // Actions - Commit
  setCommitMessage: (message: string) => void;
  setCommitAmend: (amend: boolean) => void;
  commit: (projectPath: string) => Promise<GitCommitInfo>;
  clearCommitForm: () => void;

  // Actions - Branches
  loadBranches: (projectPath: string) => Promise<void>;
  createBranch: (
    projectPath: string,
    name: string,
    fromRef?: string,
    checkout?: boolean
  ) => Promise<void>;
  switchBranch: (projectPath: string, name: string) => Promise<void>;
  deleteBranch: (
    projectPath: string,
    name: string,
    force?: boolean
  ) => Promise<void>;
  checkUncommittedChanges: (projectPath: string) => Promise<boolean>;

  // Actions - Stash
  loadStashes: (projectPath: string) => Promise<void>;
  stashSave: (
    projectPath: string,
    message?: string,
    includeUntracked?: boolean
  ) => Promise<void>;
  stashPop: (projectPath: string, index: number) => Promise<void>;
  stashApply: (projectPath: string, index: number) => Promise<void>;
  stashDrop: (projectPath: string, index: number) => Promise<void>;

  // Actions - Blame
  loadBlame: (projectPath: string, filePath: string) => Promise<void>;
  getBlameForLine: (filePath: string, lineNumber: number) => GitBlameLine | null;
  clearBlameForFile: (filePath: string) => void;
  clearBlameCache: () => void;
  refreshBlameForFile: (projectPath: string, filePath: string) => Promise<void>;

  // Actions - HEAD content (for gutter diff)
  loadHeadContent: (projectPath: string, filePath: string) => Promise<void>;
  getHeadContent: (filePath: string) => string | null;
  refreshHeadContent: (projectPath: string, filePath: string) => Promise<void>;
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

  // Commit state
  commitMessage: "",
  commitAmend: false,
  commitLoading: false,

  // Branch state
  branches: [],
  branchesLoading: false,

  // Stash state
  stashes: [],
  stashesLoading: false,

  // Blame state
  blameCache: {},
  blameLoading: {},

  // HEAD content state (for gutter)
  headContent: {},
  headContentLoading: {},

  // ============================================================
  // Status Actions
  // ============================================================

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

  // ============================================================
  // Commit Actions
  // ============================================================

  setCommitMessage: (message) => {
    set({ commitMessage: message });
  },

  setCommitAmend: (amend) => {
    set({ commitAmend: amend });
  },

  commit: async (projectPath) => {
    const { commitMessage, commitAmend } = get();

    if (!commitMessage.trim()) {
      throw new Error("Commit message cannot be empty");
    }

    set({ commitLoading: true });
    try {
      const result = await gitCommit(projectPath, {
        message: commitMessage,
        amend: commitAmend,
      });

      // Clear form and refresh status
      set({ commitMessage: "", commitAmend: false, commitLoading: false });
      await get().refresh(projectPath);

      return result;
    } catch (error) {
      set({ commitLoading: false });
      throw error;
    }
  },

  clearCommitForm: () => {
    set({ commitMessage: "", commitAmend: false });
  },

  // ============================================================
  // Branch Actions
  // ============================================================

  loadBranches: async (projectPath) => {
    set({ branchesLoading: true });
    try {
      const branches = await gitListBranches(projectPath);
      set({ branches, branchesLoading: false });
    } catch (error) {
      console.error("Failed to load branches:", error);
      set({ branchesLoading: false });
    }
  },

  createBranch: async (projectPath, name, fromRef, checkout = true) => {
    await gitCreateBranch(projectPath, name, fromRef, checkout);
    await get().loadBranches(projectPath);
    await get().refresh(projectPath);
  },

  switchBranch: async (projectPath, name) => {
    await gitSwitchBranch(projectPath, name);
    await get().loadBranches(projectPath);
    await get().refresh(projectPath);
    // Clear blame cache on branch switch
    set({ blameCache: {} });
  },

  deleteBranch: async (projectPath, name, force = false) => {
    await gitDeleteBranch(projectPath, name, force);
    await get().loadBranches(projectPath);
  },

  checkUncommittedChanges: async (projectPath) => {
    return gitCheckUncommittedChanges(projectPath);
  },

  // ============================================================
  // Stash Actions
  // ============================================================

  loadStashes: async (projectPath) => {
    set({ stashesLoading: true });
    try {
      const stashes = await gitStashList(projectPath);
      set({ stashes, stashesLoading: false });
    } catch (error) {
      console.error("Failed to load stashes:", error);
      set({ stashesLoading: false });
    }
  },

  stashSave: async (projectPath, message, includeUntracked = true) => {
    await gitStashSave(projectPath, message, includeUntracked);
    await get().loadStashes(projectPath);
    await get().refresh(projectPath);
  },

  stashPop: async (projectPath, index) => {
    await gitStashPop(projectPath, index);
    await get().loadStashes(projectPath);
    await get().refresh(projectPath);
  },

  stashApply: async (projectPath, index) => {
    await gitStashApply(projectPath, index);
    await get().loadStashes(projectPath);
    await get().refresh(projectPath);
  },

  stashDrop: async (projectPath, index) => {
    await gitStashDrop(projectPath, index);
    await get().loadStashes(projectPath);
  },

  // ============================================================
  // Blame Actions
  // ============================================================

  loadBlame: async (projectPath: string, filePath: string) => {
    // Check if already loading
    if (get().blameLoading[filePath]) {
      return;
    }

    set((state) => ({
      blameLoading: { ...state.blameLoading, [filePath]: true },
    }));

    try {
      const result = await gitBlame(projectPath, filePath);
      set((state) => ({
        blameCache: { ...state.blameCache, [filePath]: result },
        blameLoading: { ...state.blameLoading, [filePath]: false },
      }));
    } catch (error) {
      console.error("Failed to load blame:", error);
      set((state) => ({
        blameLoading: { ...state.blameLoading, [filePath]: false },
      }));
    }
  },

  getBlameForLine: (filePath, lineNumber) => {
    const blame = get().blameCache[filePath];
    if (!blame) {
      return null;
    }
    return blame.lines.find((l) => l.lineNumber === lineNumber) ?? null;
  },

  clearBlameForFile: (filePath: string) => {
    set((state) => {
      const newBlameCache = { ...state.blameCache };
      const newBlameLoading = { ...state.blameLoading };
      delete newBlameCache[filePath];
      delete newBlameLoading[filePath];
      return {
        blameCache: newBlameCache,
        blameLoading: newBlameLoading,
      };
    });
  },

  clearBlameCache: () => {
    set({ blameCache: {}, blameLoading: {} });
  },

  refreshBlameForFile: async (projectPath: string, filePath: string) => {
    // Clear the cache for this file first
    get().clearBlameForFile(filePath);
    // Then reload blame data
    await get().loadBlame(projectPath, filePath);
  },

  // ============================================================
  // HEAD Content Actions (for gutter diff)
  // ============================================================

  loadHeadContent: async (projectPath: string, filePath: string) => {
    // Check if already loading or cached
    if (get().headContentLoading[filePath] || get().headContent[filePath] !== undefined) {
      return;
    }

    set((state) => ({
      headContentLoading: { ...state.headContentLoading, [filePath]: true },
    }));

    try {
      const content = await gitShowHead(projectPath, filePath);
      set((state) => ({
        // Use empty string for new files (not in HEAD)
        headContent: { ...state.headContent, [filePath]: content ?? "" },
        headContentLoading: { ...state.headContentLoading, [filePath]: false },
      }));
    } catch (error) {
      console.error("Failed to load HEAD content:", error);
      set((state) => ({
        headContentLoading: { ...state.headContentLoading, [filePath]: false },
      }));
    }
  },

  getHeadContent: (filePath: string) => {
    const content = get().headContent[filePath];
    return content !== undefined ? content : null;
  },

  refreshHeadContent: async (projectPath: string, filePath: string) => {
    // Clear the cache for this file first
    set((state) => {
      const newHeadContent = { ...state.headContent };
      const newHeadContentLoading = { ...state.headContentLoading };
      delete newHeadContent[filePath];
      delete newHeadContentLoading[filePath];
      return {
        headContent: newHeadContent,
        headContentLoading: newHeadContentLoading,
      };
    });
    // Then reload HEAD content
    await get().loadHeadContent(projectPath, filePath);
  },
}));
