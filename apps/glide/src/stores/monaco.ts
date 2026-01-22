/**
 * Monaco Store - Centralized state for Monaco editor
 *
 * Single source of truth for:
 * - Monaco instance and active editor
 * - Per-tab metadata (blame, symbols, lineDiff) keyed by path+groupId
 *
 * NOTE: Tab-specific data (content, headContent, cursor, scroll, isDirty) is in tabs.ts.
 * This store only manages Monaco-specific state per editor instance.
 */

import { create } from "zustand";
import type * as monacoEditor from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { LineDiffResult } from "../lib/lineDiff";
import type { GitBlameResult } from "../types";
import type { LspDocumentSymbol } from "../types/lsp";

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

/**
 * Per-tab editor metadata.
 * Keyed by `${filePath}:${groupId}` since same file can be in different groups.
 */
export interface EditorMetadata {
  filePath: string;
  groupId: string;
  // Computed line diff (computed from headContent in tabs store)
  lineDiff: LineDiffResult | null;
  // Git blame
  blameData: GitBlameResult | null;
  blameLoading: boolean;
  // LSP symbols
  symbols: LspDocumentSymbol[];
  symbolsLoading: boolean;
}

/** Monaco store state */
interface MonacoState {
  // Monaco instances (not persisted)
  monacoInstance: Monaco | null;
  activeEditor: monacoEditor.editor.IStandaloneCodeEditor | null;

  // Initialization tracking
  initState: MonacoInitState;

  // Per-tab editor metadata (keyed by `${filePath}:${groupId}`)
  editorMetadata: Record<string, EditorMetadata>;

  // === INITIALIZATION ACTIONS ===
  setMonacoInstance: (monaco: Monaco) => void;
  setActiveEditor: (
    editor: monacoEditor.editor.IStandaloneCodeEditor | null
  ) => void;
  setInitStatus: (status: InitStatus, error?: string) => void;

  // === EDITOR METADATA ACTIONS ===
  /**
   * Initialize or get editor metadata for a path+group.
   * Creates a new entry if one doesn't exist.
   */
  ensureEditorMetadata: (filePath: string, groupId: string) => EditorMetadata;

  /**
   * Remove editor metadata when tab is closed.
   */
  removeEditorMetadata: (filePath: string, groupId: string) => void;

  // === LINE DIFF ===
  setLineDiff: (filePath: string, groupId: string, diff: LineDiffResult | null) => void;

  // === BLAME ACTIONS ===
  setBlameData: (filePath: string, groupId: string, data: GitBlameResult | null) => void;
  setBlameLoading: (filePath: string, groupId: string, loading: boolean) => void;

  // === SYMBOLS ACTIONS ===
  setSymbols: (filePath: string, groupId: string, symbols: LspDocumentSymbol[]) => void;
  setSymbolsLoading: (filePath: string, groupId: string, loading: boolean) => void;

  // === GETTERS ===
  getEditorMetadata: (filePath: string, groupId: string) => EditorMetadata | null;

  // === CLEANUP ===
  clearAllBlameCaches: () => void;
}

// ============================================================
// Helpers
// ============================================================

function makeKey(filePath: string, groupId: string): string {
  return `${filePath}:${groupId}`;
}

function createDefaultEditorMetadata(filePath: string, groupId: string): EditorMetadata {
  return {
    filePath,
    groupId,
    lineDiff: null,
    blameData: null,
    blameLoading: false,
    symbols: [],
    symbolsLoading: false,
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
  editorMetadata: {},

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

  // === EDITOR METADATA ACTIONS ===

  ensureEditorMetadata: (filePath, groupId) => {
    const key = makeKey(filePath, groupId);
    const existing = get().editorMetadata[key];
    if (existing) return existing;

    const newMetadata = createDefaultEditorMetadata(filePath, groupId);
    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: newMetadata,
      },
    }));
    return newMetadata;
  },

  removeEditorMetadata: (filePath, groupId) => {
    const key = makeKey(filePath, groupId);
    const { [key]: _, ...rest } = get().editorMetadata;
    set({ editorMetadata: rest });
  },

  // === LINE DIFF ===

  setLineDiff: (filePath, groupId, diff) => {
    const key = makeKey(filePath, groupId);
    const metadata = get().editorMetadata[key];

    if (!metadata) {
      set((state) => ({
        editorMetadata: {
          ...state.editorMetadata,
          [key]: {
            ...createDefaultEditorMetadata(filePath, groupId),
            lineDiff: diff,
          },
        },
      }));
      return;
    }

    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: { ...metadata, lineDiff: diff },
      },
    }));
  },

  // === BLAME ACTIONS ===

  setBlameData: (filePath, groupId, data) => {
    const key = makeKey(filePath, groupId);
    const metadata = get().editorMetadata[key];

    if (!metadata) {
      set((state) => ({
        editorMetadata: {
          ...state.editorMetadata,
          [key]: {
            ...createDefaultEditorMetadata(filePath, groupId),
            blameData: data,
            blameLoading: false,
          },
        },
      }));
      return;
    }

    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: { ...metadata, blameData: data, blameLoading: false },
      },
    }));
  },

  setBlameLoading: (filePath, groupId, loading) => {
    const key = makeKey(filePath, groupId);
    const metadata = get().editorMetadata[key];

    if (!metadata) {
      set((state) => ({
        editorMetadata: {
          ...state.editorMetadata,
          [key]: {
            ...createDefaultEditorMetadata(filePath, groupId),
            blameLoading: loading,
          },
        },
      }));
      return;
    }

    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: { ...metadata, blameLoading: loading },
      },
    }));
  },

  // === SYMBOLS ACTIONS ===

  setSymbols: (filePath, groupId, symbols) => {
    const key = makeKey(filePath, groupId);
    const metadata = get().editorMetadata[key];

    if (!metadata) {
      set((state) => ({
        editorMetadata: {
          ...state.editorMetadata,
          [key]: {
            ...createDefaultEditorMetadata(filePath, groupId),
            symbols,
            symbolsLoading: false,
          },
        },
      }));
      return;
    }

    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: { ...metadata, symbols, symbolsLoading: false },
      },
    }));
  },

  setSymbolsLoading: (filePath, groupId, loading) => {
    const key = makeKey(filePath, groupId);
    const metadata = get().editorMetadata[key];

    if (!metadata) {
      set((state) => ({
        editorMetadata: {
          ...state.editorMetadata,
          [key]: {
            ...createDefaultEditorMetadata(filePath, groupId),
            symbolsLoading: loading,
          },
        },
      }));
      return;
    }

    set((state) => ({
      editorMetadata: {
        ...state.editorMetadata,
        [key]: { ...metadata, symbolsLoading: loading },
      },
    }));
  },

  // === GETTERS ===

  getEditorMetadata: (filePath, groupId) => {
    const key = makeKey(filePath, groupId);
    return get().editorMetadata[key] ?? null;
  },

  // === CLEANUP ===

  clearAllBlameCaches: () => {
    set((state) => {
      const newEditorMetadata: Record<string, EditorMetadata> = {};

      for (const [key, data] of Object.entries(state.editorMetadata)) {
        newEditorMetadata[key] = {
          ...data,
          blameData: null,
          lineDiff: null,
        };
      }

      return { editorMetadata: newEditorMetadata };
    });
  },
}));
