/**
 * Monaco Store - Centralized state for Monaco editor
 *
 * Single source of truth for:
 * - Monaco instance and active editor
 * - Per-file blame data and symbols
 * - Line diff computation
 *
 * NOTE: Tab management is handled by the tabs store.
 * This store only manages Monaco-specific state.
 */

import { create } from "zustand";
import type * as monacoEditor from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { LineDiffResult } from "../lib/lineDiff";
import type { GitBlameResult } from "../types";
import type { LspDocumentSymbol } from "../types/lsp";
import { computeLineDiff } from "../lib/lineDiff";

// ============================================================
// Types
// ============================================================

/** Initialization status for Monaco setup */
export type InitStatus = "idle" | "loading" | "ready" | "error";

/** Monaco initialization state */
export interface MonacoInitState {
  status: InitStatus;
  error: string | null;
}

/** Per-file data for Monaco features (blame, symbols, diff) */
export interface FileData {
  path: string;
  // Content tracking
  currentContent: string;
  savedContent: string;
  headContent: string | null;
  // Computed data
  lineDiff: LineDiffResult | null;
  // Git blame
  blameData: GitBlameResult | null;
  blameLoading: boolean;
  // LSP symbols
  symbols: LspDocumentSymbol[];
  symbolsLoading: boolean;
  // Session state
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
}

/** Monaco store state */
interface MonacoState {
  // Monaco instances (not persisted)
  monacoInstance: Monaco | null;
  activeEditor: monacoEditor.editor.IStandaloneCodeEditor | null;

  // Initialization tracking
  initState: MonacoInitState;

  // Per-file data (keyed by file path)
  fileData: Record<string, FileData>;

  // === INITIALIZATION ACTIONS ===
  setMonacoInstance: (monaco: Monaco) => void;
  setActiveEditor: (
    editor: monacoEditor.editor.IStandaloneCodeEditor | null
  ) => void;
  setInitStatus: (status: InitStatus, error?: string) => void;

  // === FILE DATA ACTIONS ===
  /**
   * Initialize file data when a file is opened.
   * Call this when a file tab is resolved/loaded.
   */
  initFileData: (
    path: string,
    content: string,
    savedContent: string,
    headContent: string | null
  ) => void;

  /**
   * Update current content (called on editor changes).
   * Also triggers lineDiff recomputation.
   */
  updateFileContent: (path: string, content: string) => void;

  /**
   * Mark file as saved (update savedContent).
   */
  markFileSaved: (path: string, newSavedContent: string) => void;

  /**
   * Remove file data when tab is closed.
   */
  removeFileData: (path: string) => void;

  // === BLAME/SYMBOLS ACTIONS ===
  setHeadContent: (path: string, content: string | null) => void;
  setLineDiff: (path: string, diff: LineDiffResult | null) => void;
  setBlameData: (path: string, data: GitBlameResult | null) => void;
  setBlameLoading: (path: string, loading: boolean) => void;
  setSymbols: (path: string, symbols: LspDocumentSymbol[]) => void;
  setSymbolsLoading: (path: string, loading: boolean) => void;

  // === SESSION ACTIONS ===
  saveCursorPosition: (
    path: string,
    pos: { line: number; column: number }
  ) => void;
  saveScrollPosition: (
    path: string,
    pos: { top: number; left: number }
  ) => void;

  // === GETTERS ===
  getFileData: (path: string) => FileData | null;
  /** @deprecated Use getFileData instead - provided for backwards compatibility */
  getFileState: (path: string) => FileData | null;
  isDirty: (path: string) => boolean;

  // === CLEANUP ===
  clearAllBlameCaches: () => void;
}

// ============================================================
// Debouncing for line diff computation
// ============================================================

const diffDebounceMap = new Map<string, number>();
const DIFF_DEBOUNCE_MS = 200;

function scheduleDiffUpdate(path: string) {
  const existing = diffDebounceMap.get(path);
  if (existing) clearTimeout(existing);

  const timeout = window.setTimeout(() => {
    diffDebounceMap.delete(path);
    const state = useMonacoStore.getState();
    const fileData = state.getFileData(path);
    if (!fileData || fileData.headContent === null) return;

    const lineDiff = computeLineDiff(fileData.headContent, fileData.currentContent);
    state.setLineDiff(path, lineDiff);
  }, DIFF_DEBOUNCE_MS);

  diffDebounceMap.set(path, timeout);
}

// ============================================================
// Helper to create default file data
// ============================================================

function createDefaultFileData(
  path: string,
  content: string,
  savedContent: string,
  headContent: string | null
): FileData {
  return {
    path,
    currentContent: content,
    savedContent,
    headContent,
    lineDiff: headContent ? computeLineDiff(headContent, content) : null,
    blameData: null,
    blameLoading: false,
    symbols: [],
    symbolsLoading: false,
    cursorPosition: { line: 1, column: 1 },
    scrollPosition: { top: 0, left: 0 },
  };
}

// ============================================================
// Store Implementation
// ============================================================

export const useMonacoStore = create<MonacoState>()((set, get) => ({
  // Initial state
  monacoInstance: null,
  activeEditor: null,
  initState: {
    status: "idle",
    error: null,
  },
  fileData: {},

  // === INITIALIZATION ACTIONS ===

  setMonacoInstance: (monaco) => {
    set({ monacoInstance: monaco });
  },

  setActiveEditor: (editor) => {
    set({ activeEditor: editor });
  },

  setInitStatus: (status, error) => {
    set({
      initState: {
        status,
        error: error ?? null,
      },
    });
  },

  // === FILE DATA ACTIONS ===

  initFileData: (path, content, savedContent, headContent) => {
    const existing = get().fileData[path];
    if (existing) {
      // Already initialized, just update content
      set((state) => ({
        fileData: {
          ...state.fileData,
          [path]: {
            ...existing,
            currentContent: content,
            savedContent,
            headContent,
            lineDiff: headContent ? computeLineDiff(headContent, content) : null,
          },
        },
      }));
    } else {
      // Create new entry
      set((state) => ({
        fileData: {
          ...state.fileData,
          [path]: createDefaultFileData(path, content, savedContent, headContent),
        },
      }));
    }
  },

  updateFileContent: (path, content) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, currentContent: content },
      },
    }));

    // Schedule diff update
    scheduleDiffUpdate(path);
  },

  markFileSaved: (path, newSavedContent) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, savedContent: newSavedContent },
      },
    }));
  },

  removeFileData: (path) => {
    const { [path]: _, ...rest } = get().fileData;
    set({ fileData: rest });
  },

  // === BLAME/SYMBOLS ACTIONS ===

  setHeadContent: (path, content) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    const lineDiff =
      content !== null ? computeLineDiff(content, fileData.currentContent) : null;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, headContent: content, lineDiff },
      },
    }));
  },

  setLineDiff: (path, diff) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, lineDiff: diff },
      },
    }));
  },

  setBlameData: (path, data) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, blameData: data, blameLoading: false },
      },
    }));
  },

  setBlameLoading: (path, loading) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, blameLoading: loading },
      },
    }));
  },

  setSymbols: (path, symbols) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, symbols, symbolsLoading: false },
      },
    }));
  },

  setSymbolsLoading: (path, loading) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, symbolsLoading: loading },
      },
    }));
  },

  // === SESSION ACTIONS ===

  saveCursorPosition: (path, pos) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, cursorPosition: pos },
      },
    }));
  },

  saveScrollPosition: (path, pos) => {
    const fileData = get().fileData[path];
    if (!fileData) return;

    set((state) => ({
      fileData: {
        ...state.fileData,
        [path]: { ...fileData, scrollPosition: pos },
      },
    }));
  },

  // === GETTERS ===

  getFileData: (path) => {
    return get().fileData[path] ?? null;
  },

  /** @deprecated Use getFileData instead - provided for backwards compatibility */
  getFileState: (path) => {
    return get().fileData[path] ?? null;
  },

  isDirty: (path) => {
    const fileData = get().fileData[path];
    if (!fileData) return false;
    return fileData.currentContent !== fileData.savedContent;
  },

  // === CLEANUP ===

  clearAllBlameCaches: () => {
    set((state) => {
      const newFileData: Record<string, FileData> = {};

      for (const [path, data] of Object.entries(state.fileData)) {
        newFileData[path] = {
          ...data,
          blameData: null,
          headContent: null,
          lineDiff: null,
        };
      }

      return { fileData: newFileData };
    });
  },
}));

// ============================================================
// Re-export for backwards compatibility during migration
// ============================================================

/** @deprecated Use useMonacoStore instead */
export const useEditorStore = useMonacoStore;
