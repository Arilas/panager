/**
 * Editor Store - Centralized state for Monaco editor
 *
 * Single source of truth for:
 * - Open tabs and active tab
 * - File content and dirty state
 * - Blame data, symbols, and diff information
 * - Session state (cursor position, scroll position, etc.)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type * as monacoEditor from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { LineDiffResult } from "../lib/lineDiff";
import type { GitBlameResult } from "../types";
import type { LspDocumentSymbol } from "../types/lsp";
import { computeLineDiff } from "../lib/lineDiff";
import {
  notifyFileOpened,
  notifyFileClosed,
  notifyFileChanged,
} from "../lib/tauri-ide";

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

/** Base tab state shared by all tab types */
interface BaseTabState {
  path: string;
  language: string;
}

/** Regular file editor state */
export interface FileTabState extends BaseTabState {
  type: "file";
  content: string;
  savedContent: string; // For dirty detection
  headContent: string | null; // From git HEAD
  lineDiff: LineDiffResult | null;
  blameData: GitBlameResult | null;
  blameLoading: boolean;
  symbols: LspDocumentSymbol[];
  symbolsLoading: boolean;
  // Session persistence
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
  selections: monacoEditor.ISelection[];
  foldedRegions: number[];
}

/** Diff tab state for viewing git diffs */
export interface DiffTabState extends BaseTabState {
  type: "diff";
  /** Display name for the tab */
  fileName: string;
  /** Original content (from HEAD) */
  originalContent: string;
  /** Modified content (current working tree or staged) */
  modifiedContent: string;
  /** Whether this is showing staged changes */
  staged: boolean;
}

/** Union type for all tab states */
export type TabState = FileTabState | DiffTabState;

/** @deprecated Use FileTabState instead */
export type FileEditorState = FileTabState;

/** Type guard to check if a tab is a file tab */
export function isFileTab(tab: TabState | null | undefined): tab is FileTabState {
  return tab !== null && tab !== undefined && tab.type === "file";
}

/** Type guard to check if a tab is a diff tab */
export function isDiffTab(tab: TabState | null | undefined): tab is DiffTabState {
  return tab !== null && tab !== undefined && tab.type === "diff";
}

/** Persisted session data (subset of FileTabState) */
interface PersistedFileSession {
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
  selections: monacoEditor.ISelection[];
  foldedRegions: number[];
}

/** Editor store state */
interface EditorState {
  // Monaco instances (not persisted)
  monacoInstance: Monaco | null;
  activeEditor: monacoEditor.editor.IStandaloneCodeEditor | null;

  // Initialization tracking
  initState: MonacoInitState;

  // === TABS (single source of truth) ===
  openTabs: string[]; // Ordered list of tab paths (tab order)
  activeTabPath: string | null; // Currently active tab
  previewTab: TabState | null; // Single preview tab (replaced on new preview)

  // === TAB STATE (keyed by path) ===
  tabStates: Record<string, TabState>; // Permanent tabs only

  // === PERSISTED SESSION DATA ===
  sessionData: Record<string, PersistedFileSession>; // Session data for restoration

  // Settings
  gitBlameEnabled: boolean;
  codeLensEnabled: boolean;
  gitGutterEnabled: boolean;

  // === INITIALIZATION ACTIONS ===
  setMonacoInstance: (monaco: Monaco) => void;
  setActiveEditor: (editor: monacoEditor.editor.IStandaloneCodeEditor | null) => void;
  setInitStatus: (status: InitStatus, error?: string) => void;

  // === TAB ACTIONS ===
  openTab: (
    path: string,
    content: string,
    language: string,
    isPreview?: boolean
  ) => void;
  openDiffTab: (diff: DiffTabState, isPreview?: boolean) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  convertPreviewToPermanent: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // === CONTENT ACTIONS ===
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, newSavedContent: string) => void;

  // === EDITOR DATA ACTIONS ===
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
  saveSelections: (path: string, selections: monacoEditor.ISelection[]) => void;
  saveFoldedRegions: (path: string, regions: number[]) => void;

  // === GETTERS ===
  getTabState: (path: string) => TabState | null;
  getFileState: (path: string) => FileTabState | null;
  getActiveTabState: () => TabState | null;
  getActiveFileState: () => FileTabState | null;
  isDirty: (path: string) => boolean;
  hasUnsavedChanges: () => boolean;

  // === SETTINGS ACTIONS ===
  setGitBlameEnabled: (enabled: boolean) => void;
  setCodeLensEnabled: (enabled: boolean) => void;
  setGitGutterEnabled: (enabled: boolean) => void;

  // === CLEANUP ===
  clearAllBlameCaches: () => void;
}

// ============================================================
// Debouncing for LSP notifications
// ============================================================

const contentChangeDebounceMap = new Map<string, number>();
const CONTENT_DEBOUNCE_MS = 150;

function debouncedNotifyFileChanged(path: string, content: string) {
  const existing = contentChangeDebounceMap.get(path);
  if (existing) clearTimeout(existing);

  const timeout = window.setTimeout(() => {
    contentChangeDebounceMap.delete(path);
    notifyFileChanged(path, content).catch(console.error);
  }, CONTENT_DEBOUNCE_MS);

  contentChangeDebounceMap.set(path, timeout);
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
    const state = useEditorStore.getState();
    const fileState = state.getFileState(path);
    if (!fileState || fileState.headContent === null) return;

    const lineDiff = computeLineDiff(fileState.headContent, fileState.content);
    state.setLineDiff(path, lineDiff);
  }, DIFF_DEBOUNCE_MS);

  diffDebounceMap.set(path, timeout);
}

// ============================================================
// Helper to create default file state
// ============================================================

function createDefaultFileState(
  path: string,
  content: string,
  language: string,
  existingSession?: PersistedFileSession
): FileTabState {
  return {
    type: "file",
    path,
    language,
    content,
    savedContent: content,
    headContent: null,
    lineDiff: null,
    blameData: null,
    blameLoading: false,
    symbols: [],
    symbolsLoading: false,
    cursorPosition: existingSession?.cursorPosition ?? { line: 1, column: 1 },
    scrollPosition: existingSession?.scrollPosition ?? { top: 0, left: 0 },
    selections: existingSession?.selections ?? [],
    foldedRegions: existingSession?.foldedRegions ?? [],
  };
}

// ============================================================
// Store Implementation
// ============================================================

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      monacoInstance: null,
      activeEditor: null,
      initState: {
        status: "idle",
        error: null,
      },
      openTabs: [],
      activeTabPath: null,
      previewTab: null,
      tabStates: {},
      sessionData: {},
      gitBlameEnabled: true,
      codeLensEnabled: true,
      gitGutterEnabled: true,

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

      // === TAB ACTIONS ===

      openTab: (path, content, language, isPreview = false) => {
        const state = get();

        // Check if already open as permanent tab
        if (state.tabStates[path] || state.openTabs.includes(path)) {
          // If in openTabs but not in tabStates (e.g., after rehydration), populate tabStates
          if (!state.tabStates[path] && state.openTabs.includes(path)) {
            const existingSession = state.sessionData[path];
            const newFileState = createDefaultFileState(
              path,
              content,
              language,
              existingSession
            );
            set((s) => ({
              tabStates: { ...s.tabStates, [path]: newFileState },
              activeTabPath: path,
            }));
            notifyFileOpened(path, content).catch(console.error);
            return;
          }
          set({ activeTabPath: path });
          return;
        }

        // Check if it's the current preview tab
        if (state.previewTab?.path === path) {
          set({ activeTabPath: path });
          return;
        }

        // Get existing session data for restoration
        const existingSession = state.sessionData[path];

        if (isPreview) {
          // Close existing preview if different file (only for file tabs)
          if (state.previewTab && state.previewTab.path !== path && isFileTab(state.previewTab)) {
            notifyFileClosed(state.previewTab.path).catch(console.error);
          }

          // Create new preview tab
          const newPreviewTab = createDefaultFileState(
            path,
            content,
            language,
            existingSession
          );

          set({
            previewTab: newPreviewTab,
            activeTabPath: path,
          });
        } else {
          // Create permanent tab
          const newFileState = createDefaultFileState(
            path,
            content,
            language,
            existingSession
          );

          set((state) => ({
            openTabs: [...state.openTabs, path],
            tabStates: { ...state.tabStates, [path]: newFileState },
            activeTabPath: path,
          }));
        }

        // Notify LSP about file open
        notifyFileOpened(path, content).catch(console.error);
      },

      openDiffTab: (diff, isPreview = true) => {
        const state = get();
        const diffPath = `diff://${diff.path}${diff.staged ? ":staged" : ""}`;

        // Check if already open as permanent tab
        if (state.tabStates[diffPath] || state.openTabs.includes(diffPath)) {
          set({ activeTabPath: diffPath });
          return;
        }

        // Check if it's the current preview tab
        if (state.previewTab?.path === diffPath) {
          set({ activeTabPath: diffPath });
          return;
        }

        const diffTabState: DiffTabState = {
          ...diff,
          path: diffPath,
        };

        if (isPreview) {
          // Close existing preview if different
          if (state.previewTab && state.previewTab.path !== diffPath && isFileTab(state.previewTab)) {
            notifyFileClosed(state.previewTab.path).catch(console.error);
          }

          set({
            previewTab: diffTabState,
            activeTabPath: diffPath,
          });
        } else {
          set((state) => ({
            openTabs: [...state.openTabs, diffPath],
            tabStates: { ...state.tabStates, [diffPath]: diffTabState },
            activeTabPath: diffPath,
          }));
        }
      },

      closeTab: (path) => {
        const state = get();

        // Check if closing preview tab
        if (state.previewTab?.path === path) {
          // Save session data before closing (only for file tabs)
          if (isFileTab(state.previewTab)) {
            const session: PersistedFileSession = {
              cursorPosition: state.previewTab.cursorPosition,
              scrollPosition: state.previewTab.scrollPosition,
              selections: state.previewTab.selections,
              foldedRegions: state.previewTab.foldedRegions,
            };

            set((s) => ({
              previewTab: null,
              activeTabPath:
                s.activeTabPath === path
                  ? s.openTabs[s.openTabs.length - 1] ?? null
                  : s.activeTabPath,
              sessionData: { ...s.sessionData, [path]: session },
            }));

            notifyFileClosed(path).catch(console.error);
          } else {
            // Diff tab - no session to save
            set((s) => ({
              previewTab: null,
              activeTabPath:
                s.activeTabPath === path
                  ? s.openTabs[s.openTabs.length - 1] ?? null
                  : s.activeTabPath,
            }));
          }
          return;
        }

        // Closing permanent tab
        const tabState = state.tabStates[path];
        if (!tabState) return;

        // Save session data before closing (only for file tabs)
        let newSessionData = state.sessionData;
        if (isFileTab(tabState)) {
          const session: PersistedFileSession = {
            cursorPosition: tabState.cursorPosition,
            scrollPosition: tabState.scrollPosition,
            selections: tabState.selections,
            foldedRegions: tabState.foldedRegions,
          };
          newSessionData = { ...state.sessionData, [path]: session };
        }

        const tabIndex = state.openTabs.indexOf(path);
        const newOpenTabs = state.openTabs.filter((p) => p !== path);
        const newTabStates = { ...state.tabStates };
        delete newTabStates[path];

        // Determine new active tab
        let newActiveTab = state.activeTabPath;
        if (state.activeTabPath === path) {
          if (newOpenTabs.length > 0) {
            // Select previous or next tab
            newActiveTab =
              newOpenTabs[Math.min(tabIndex, newOpenTabs.length - 1)];
          } else if (state.previewTab) {
            newActiveTab = state.previewTab.path;
          } else {
            newActiveTab = null;
          }
        }

        set({
          openTabs: newOpenTabs,
          tabStates: newTabStates,
          activeTabPath: newActiveTab,
          sessionData: newSessionData,
        });

        // Notify LSP for file tabs
        if (isFileTab(tabState)) {
          notifyFileClosed(path).catch(console.error);
        }
      },

      closeOtherTabs: (path) => {
        const state = get();

        // Close all tabs except the specified one
        for (const tabPath of state.openTabs) {
          if (tabPath !== path) {
            const tabState = state.tabStates[tabPath];
            if (isFileTab(tabState)) {
              notifyFileClosed(tabPath).catch(console.error);
            }
          }
        }

        // Close preview if it's not the specified path
        if (state.previewTab && state.previewTab.path !== path) {
          if (isFileTab(state.previewTab)) {
            notifyFileClosed(state.previewTab.path).catch(console.error);
          }
        }

        const keepTabState = state.tabStates[path];
        const keepPreview =
          state.previewTab?.path === path ? state.previewTab : null;

        set({
          openTabs: keepTabState ? [path] : [],
          tabStates: keepTabState ? { [path]: keepTabState } : {},
          previewTab: keepPreview,
          activeTabPath: path,
        });
      },

      closeAllTabs: () => {
        const state = get();

        // Notify LSP about all closed file tabs
        for (const path of state.openTabs) {
          const tabState = state.tabStates[path];
          if (isFileTab(tabState)) {
            notifyFileClosed(path).catch(console.error);
          }
        }
        if (state.previewTab && isFileTab(state.previewTab)) {
          notifyFileClosed(state.previewTab.path).catch(console.error);
        }

        set({
          openTabs: [],
          tabStates: {},
          previewTab: null,
          activeTabPath: null,
        });
      },

      setActiveTab: (path) => {
        set({ activeTabPath: path });
      },

      convertPreviewToPermanent: () => {
        const state = get();
        if (!state.previewTab) return;

        const previewTab = state.previewTab;

        set((s) => ({
          openTabs: [...s.openTabs, previewTab.path],
          tabStates: { ...s.tabStates, [previewTab.path]: previewTab },
          previewTab: null,
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.openTabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { openTabs: newTabs };
        });
      },

      // === CONTENT ACTIONS ===

      updateContent: (path, content) => {
        const state = get();

        // Check if updating preview tab (only file tabs can be edited)
        if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
          // Auto-convert preview to permanent on edit
          const updatedTab: FileTabState = {
            ...state.previewTab,
            content,
          };

          set((s) => ({
            openTabs: [...s.openTabs, path],
            tabStates: { ...s.tabStates, [path]: updatedTab },
            previewTab: null,
          }));

          // Schedule diff update and LSP notification
          scheduleDiffUpdate(path);
          debouncedNotifyFileChanged(path, content);
          return;
        }

        // Update permanent tab (only file tabs)
        const tabState = state.tabStates[path];
        if (!tabState || !isFileTab(tabState)) return;

        set((s) => ({
          tabStates: {
            ...s.tabStates,
            [path]: { ...tabState, content },
          },
        }));

        // Schedule diff update and LSP notification
        scheduleDiffUpdate(path);
        debouncedNotifyFileChanged(path, content);
      },

      markSaved: (path, newSavedContent) => {
        set((state) => {
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, savedContent: newSavedContent },
            },
          };
        });
      },

      // === EDITOR DATA ACTIONS ===

      setHeadContent: (path, content) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            const lineDiff =
              content !== null
                ? computeLineDiff(content, state.previewTab.content)
                : null;

            return {
              previewTab: {
                ...state.previewTab,
                headContent: content,
                lineDiff,
              },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          const lineDiff =
            content !== null
              ? computeLineDiff(content, tabState.content)
              : null;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, headContent: content, lineDiff },
            },
          };
        });
      },

      setLineDiff: (path, diff) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, lineDiff: diff },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, lineDiff: diff },
            },
          };
        });
      },

      setBlameData: (path, data) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: {
                ...state.previewTab,
                blameData: data,
                blameLoading: false,
              },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, blameData: data, blameLoading: false },
            },
          };
        });
      },

      setBlameLoading: (path, loading) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, blameLoading: loading },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, blameLoading: loading },
            },
          };
        });
      },

      setSymbols: (path, symbols) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: {
                ...state.previewTab,
                symbols,
                symbolsLoading: false,
              },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, symbols, symbolsLoading: false },
            },
          };
        });
      },

      setSymbolsLoading: (path, loading) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, symbolsLoading: loading },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, symbolsLoading: loading },
            },
          };
        });
      },

      // === SESSION ACTIONS ===

      saveCursorPosition: (path, pos) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, cursorPosition: pos },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, cursorPosition: pos },
            },
          };
        });
      },

      saveScrollPosition: (path, pos) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, scrollPosition: pos },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, scrollPosition: pos },
            },
          };
        });
      },

      saveSelections: (path, selections) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, selections },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, selections },
            },
          };
        });
      },

      saveFoldedRegions: (path, regions) => {
        set((state) => {
          // Check preview tab
          if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
            return {
              previewTab: { ...state.previewTab, foldedRegions: regions },
            };
          }

          // Check permanent tabs
          const tabState = state.tabStates[path];
          if (!tabState || !isFileTab(tabState)) return state;

          return {
            tabStates: {
              ...state.tabStates,
              [path]: { ...tabState, foldedRegions: regions },
            },
          };
        });
      },

      // === GETTERS ===

      getTabState: (path) => {
        const state = get();

        // Check preview tab first
        if (state.previewTab?.path === path) {
          return state.previewTab;
        }

        // Check permanent tabs
        return state.tabStates[path] ?? null;
      },

      getFileState: (path) => {
        const state = get();

        // Check preview tab first
        if (state.previewTab?.path === path && isFileTab(state.previewTab)) {
          return state.previewTab;
        }

        // Check permanent tabs
        const tabState = state.tabStates[path];
        if (tabState && isFileTab(tabState)) {
          return tabState;
        }
        return null;
      },

      getActiveTabState: () => {
        const state = get();
        if (!state.activeTabPath) return null;
        return state.getTabState(state.activeTabPath);
      },

      getActiveFileState: () => {
        const state = get();
        if (!state.activeTabPath) return null;
        return state.getFileState(state.activeTabPath);
      },

      isDirty: (path) => {
        const fileState = get().getFileState(path);
        if (!fileState) return false;
        return fileState.content !== fileState.savedContent;
      },

      hasUnsavedChanges: () => {
        const state = get();

        // Check preview tab
        if (state.previewTab && isFileTab(state.previewTab)) {
          if (state.previewTab.content !== state.previewTab.savedContent) {
            return true;
          }
        }

        // Check permanent tabs
        for (const path of state.openTabs) {
          const tabState = state.tabStates[path];
          if (tabState && isFileTab(tabState)) {
            if (tabState.content !== tabState.savedContent) {
              return true;
            }
          }
        }

        return false;
      },

      // === SETTINGS ACTIONS ===

      setGitBlameEnabled: (enabled) => {
        set({ gitBlameEnabled: enabled });
      },

      setCodeLensEnabled: (enabled) => {
        set({ codeLensEnabled: enabled });
      },

      setGitGutterEnabled: (enabled) => {
        set({ gitGutterEnabled: enabled });
      },

      // === CLEANUP ===

      clearAllBlameCaches: () => {
        set((state) => {
          const newTabStates: Record<string, TabState> = {};

          for (const [path, tabState] of Object.entries(state.tabStates)) {
            if (isFileTab(tabState)) {
              newTabStates[path] = {
                ...tabState,
                blameData: null,
                headContent: null,
                lineDiff: null,
              };
            } else {
              newTabStates[path] = tabState;
            }
          }

          const newPreviewTab = state.previewTab
            ? isFileTab(state.previewTab)
              ? {
                  ...state.previewTab,
                  blameData: null,
                  headContent: null,
                  lineDiff: null,
                }
              : state.previewTab
            : null;

          return {
            tabStates: newTabStates,
            previewTab: newPreviewTab,
          };
        });
      },
    }),
    {
      name: "panager-editor-state",
      storage: createJSONStorage(() => localStorage),
      // Only persist session-related data and settings
      // NOTE: openTabs is NOT persisted here - it's managed by usePersistedIdeState
      // to avoid duplicate restoration issues
      partialize: (state) => ({
        sessionData: {
          ...state.sessionData,
          // Also include current session data from open file tabs
          ...Object.fromEntries(
            Object.entries(state.tabStates)
              .filter(([, ts]) => isFileTab(ts))
              .map(([path, ts]) => {
                const fileState = ts as FileTabState;
                return [
                  path,
                  {
                    cursorPosition: fileState.cursorPosition,
                    scrollPosition: fileState.scrollPosition,
                    selections: fileState.selections,
                    foldedRegions: fileState.foldedRegions,
                  },
                ];
              })
          ),
          // Include preview tab session (only for file tabs)
          ...(state.previewTab && isFileTab(state.previewTab)
            ? {
                [state.previewTab.path]: {
                  cursorPosition: state.previewTab.cursorPosition,
                  scrollPosition: state.previewTab.scrollPosition,
                  selections: state.previewTab.selections,
                  foldedRegions: state.previewTab.foldedRegions,
                },
              }
            : {}),
        },
        gitBlameEnabled: state.gitBlameEnabled,
        codeLensEnabled: state.codeLensEnabled,
        gitGutterEnabled: state.gitGutterEnabled,
      }),
    }
  )
);
