/**
 * Git state store for IDE
 *
 * Handles git status, diffs, commits, branches, and stashes.
 * NOTE: Blame, HEAD content, and CodeLens caches are now in editorStore.
 */

import { create } from "zustand";
import type {
  GitFileChange,
  GitBranchInfo,
  FileDiff,
  GitLocalBranch,
  GitStashEntry,
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
} from "../lib/tauri-ide";
import { useMonacoStore } from "./monaco";

interface GitState {
  // Git status
  changes: GitFileChange[];
  branch: GitBranchInfo | null;
  loading: boolean;
  error: string | null;

  // View mode for changes panel
  changesViewMode: "list" | "tree";
  setChangesViewMode: (mode: "list" | "tree") => void;

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
}

export const useGitStore = create<GitState>((set, get) => ({
  // Initial state
  changes: [],
  branch: null,
  loading: false,
  error: null,
  changesViewMode: "list",
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

  // ============================================================
  // View Mode Actions
  // ============================================================

  setChangesViewMode: (mode) => {
    set({ changesViewMode: mode });
  },

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
    // Clear blame caches on branch switch
    useMonacoStore.getState().clearAllBlameCaches();
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
}));
