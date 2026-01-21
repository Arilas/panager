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
  /** Original file path (for breadcrumb, copy path, etc.) */
  filePath: string;
  /** Original content (from HEAD) */
  originalContent: string;
  /** Modified content (current working tree or staged) */
  modifiedContent: string;
  /** Whether this is showing staged changes */
  staged: boolean;
}

/** Chat tab state for agent conversations */
export interface ChatTabState extends BaseTabState {
  type: "chat";
  /** Session ID for the chat */
  sessionId: string;
  /** Display name for the tab */
  sessionName: string;
}

/** Lazy file tab state - placeholder until content is loaded */
export interface LazyFileTabState extends BaseTabState {
  type: "lazy";
  targetType: "file";
  /** Display name for the tab */
  fileName: string;
}

/** Lazy diff tab state - placeholder until content is loaded */
export interface LazyDiffTabState extends BaseTabState {
  type: "lazy";
  targetType: "diff";
  /** Display name for the tab */
  fileName: string;
  /** Original file path (for breadcrumb, copy path, etc.) */
  filePath: string;
  /** Whether this is showing staged changes */
  staged: boolean;
}

/** Union type for lazy tab states */
export type LazyTabState = LazyFileTabState | LazyDiffTabState;

/** Union type for all tab states */
export type TabState = FileTabState | DiffTabState | ChatTabState | LazyTabState;

/** @deprecated Use FileTabState instead */
export type FileEditorState = FileTabState;

/** Type guard to check if a tab is a file tab */
export function isFileTab(
  tab: TabState | null | undefined,
): tab is FileTabState {
  return tab !== null && tab !== undefined && tab.type === "file";
}

/** Type guard to check if a tab is a diff tab */
export function isDiffTab(
  tab: TabState | null | undefined,
): tab is DiffTabState {
  return tab !== null && tab !== undefined && tab.type === "diff";
}

/** Type guard to check if a tab is a chat tab */
export function isChatTab(
  tab: TabState | null | undefined,
): tab is ChatTabState {
  return tab !== null && tab !== undefined && tab.type === "chat";
}

/** Type guard to check if a tab is a lazy tab */
export function isLazyTab(
  tab: TabState | null | undefined,
): tab is LazyTabState {
  return tab !== null && tab !== undefined && tab.type === "lazy";
}

/** Type guard to check if a tab is a lazy file tab */
export function isLazyFileTab(
  tab: TabState | null | undefined,
): tab is LazyFileTabState {
  return isLazyTab(tab) && tab.targetType === "file";
}

/** Type guard to check if a tab is a lazy diff tab */
export function isLazyDiffTab(
  tab: TabState | null | undefined,
): tab is LazyDiffTabState {
  return isLazyTab(tab) && tab.targetType === "diff";
}

/** Persisted session data (subset of FileTabState) */
interface PersistedFileSession {
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
  selections: monacoEditor.ISelection[];
  foldedRegions: number[];
}

/** Navigation history entry - stores path and position for back/forward */
interface NavigationEntry {
  path: string;
  position: { line: number; column: number };
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
  pinnedTabs: string[]; // Paths of pinned tabs (order matters)

  // === TAB STATE (keyed by path) ===
  tabStates: Record<string, TabState>; // Permanent tabs only

  // === PERSISTED SESSION DATA ===
  sessionData: Record<string, PersistedFileSession>; // Session data for restoration

  // === NAVIGATION HISTORY ===
  navigationHistory: NavigationEntry[]; // Stack of visited locations (path + position)
  navigationIndex: number; // Current position in history (-1 = at end)

  // Settings
  gitBlameEnabled: boolean;
  codeLensEnabled: boolean;
  gitGutterEnabled: boolean;

  // === INITIALIZATION ACTIONS ===
  setMonacoInstance: (monaco: Monaco) => void;
  setActiveEditor: (
    editor: monacoEditor.editor.IStandaloneCodeEditor | null,
  ) => void;
  setInitStatus: (status: InitStatus, error?: string) => void;

  // === TAB ACTIONS ===
  openTab: (
    path: string,
    content: string,
    language: string,
    isPreview?: boolean,
    options?: { position?: { line: number; column: number } },
  ) => void;
  openDiffTab: (diff: DiffTabState, isPreview?: boolean) => void;
  openChatTab: (sessionId: string, sessionName: string) => void;
  /** Register a lazy file tab (placeholder until content is loaded) */
  registerLazyFileTab: (path: string, fileName: string) => void;
  /** Register a lazy diff tab (placeholder until content is loaded) */
  registerLazyDiffTab: (
    path: string,
    fileName: string,
    filePath: string,
    staged: boolean,
  ) => void;
  /** Load a lazy tab - replaces it with the actual content */
  loadLazyTab: (
    path: string,
    content: string,
    language: string,
    headContent?: string | null,
  ) => void;
  /** Load a lazy diff tab - replaces it with actual diff content */
  loadLazyDiffTab: (
    path: string,
    originalContent: string,
    modifiedContent: string,
    language: string,
  ) => void;
  /** Check if a tab is lazy (needs content to be loaded) */
  isLazyTab: (path: string) => boolean;

  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  /** Set active tab with optional history tracking. Position is used for history entries. */
  setActiveTab: (path: string, pushHistory?: boolean, position?: { line: number; column: number }) => void;
  convertPreviewToPermanent: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  pinTab: (path: string) => void;
  unpinTab: (path: string) => void;
  isTabPinned: (path: string) => boolean;
  /** Set pinned tabs (for restoration) */
  setPinnedTabs: (paths: string[]) => void;

  // === NAVIGATION ACTIONS ===
  navigateBack: () => void;
  navigateForward: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;

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
    pos: { line: number; column: number },
  ) => void;
  saveScrollPosition: (
    path: string,
    pos: { top: number; left: number },
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
  existingSession?: PersistedFileSession,
  initialPosition?: { line: number; column: number },
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
    // Initial position takes precedence, then existing session, then default
    cursorPosition: initialPosition ?? existingSession?.cursorPosition ?? { line: 1, column: 1 },
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
      pinnedTabs: [],
      tabStates: {},
      sessionData: {},
      navigationHistory: [],
      navigationIndex: -1,
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

      openTab: (path, content, language, isPreview = false, options) => {
        const state = get();
        const initialPosition = options?.position;

        // First, save current location to history if we're navigating away
        // This ensures back navigation returns to where we were
        if (state.activeTabPath && state.activeTabPath !== path) {
          const currentFileState = state.getFileState(state.activeTabPath);
          if (currentFileState) {
            // Push current location to history before navigating away
            const currentPosition = currentFileState.cursorPosition;
            const newHistory = [...state.navigationHistory];

            // Truncate forward history if we're not at the end
            if (
              state.navigationIndex >= 0 &&
              state.navigationIndex < newHistory.length - 1
            ) {
              newHistory.splice(state.navigationIndex + 1);
            }

            // Add current location
            const currentEntry: NavigationEntry = {
              path: state.activeTabPath,
              position: currentPosition,
            };

            // Don't push consecutive duplicates
            const lastEntry = newHistory[newHistory.length - 1];
            const isDuplicate = lastEntry &&
              lastEntry.path === currentEntry.path &&
              lastEntry.position.line === currentEntry.position.line &&
              lastEntry.position.column === currentEntry.position.column;

            if (!isDuplicate) {
              newHistory.push(currentEntry);
              if (newHistory.length > 50) {
                newHistory.shift();
              }
            }

            set({ navigationHistory: newHistory, navigationIndex: -1 });
          }
        }

        // Check if already open as permanent tab
        if (state.tabStates[path] || state.openTabs.includes(path)) {
          // If in openTabs but not in tabStates (e.g., after rehydration), populate tabStates
          if (!state.tabStates[path] && state.openTabs.includes(path)) {
            const existingSession = state.sessionData[path];
            const newFileState = createDefaultFileState(
              path,
              content,
              language,
              existingSession,
              initialPosition,
            );
            set((s) => ({
              tabStates: { ...s.tabStates, [path]: newFileState },
            }));
            // Add destination to history and set active
            const destPosition = initialPosition ?? { line: 1, column: 1 };
            const newHistoryWithDest = [...get().navigationHistory, { path, position: destPosition }];
            if (newHistoryWithDest.length > 50) newHistoryWithDest.shift();
            set({ navigationHistory: newHistoryWithDest, activeTabPath: path });
            notifyFileOpened(path, content).catch(console.error);
            return;
          }
          // Update position if provided
          if (initialPosition) {
            get().saveCursorPosition(path, initialPosition);
          }
          // Add destination to history and set active
          const destPosition = initialPosition ?? get().getFileState(path)?.cursorPosition ?? { line: 1, column: 1 };
          const newHistoryWithDest = [...get().navigationHistory, { path, position: destPosition }];
          if (newHistoryWithDest.length > 50) newHistoryWithDest.shift();
          set({ navigationHistory: newHistoryWithDest, activeTabPath: path });
          return;
        }

        // Check if it's the current preview tab
        if (state.previewTab?.path === path) {
          // Update position if provided
          if (initialPosition) {
            get().saveCursorPosition(path, initialPosition);
          }
          // Add destination to history and set active
          const previewCursorPos = isFileTab(state.previewTab) ? state.previewTab.cursorPosition : { line: 1, column: 1 };
          const destPosition = initialPosition ?? previewCursorPos;
          const newHistoryWithDest = [...get().navigationHistory, { path, position: destPosition }];
          if (newHistoryWithDest.length > 50) newHistoryWithDest.shift();
          set({ navigationHistory: newHistoryWithDest, activeTabPath: path });
          return;
        }

        // Get existing session data for restoration
        const existingSession = state.sessionData[path];

        if (isPreview) {
          // Close existing preview if different file (only for file tabs)
          if (
            state.previewTab &&
            state.previewTab.path !== path &&
            isFileTab(state.previewTab)
          ) {
            notifyFileClosed(state.previewTab.path).catch(console.error);
          }

          // Create new preview tab
          const newPreviewTab = createDefaultFileState(
            path,
            content,
            language,
            existingSession,
            initialPosition,
          );

          // Add destination to history and set state
          const destPosition = initialPosition ?? newPreviewTab.cursorPosition;
          const newHistoryWithDest = [...get().navigationHistory, { path, position: destPosition }];
          if (newHistoryWithDest.length > 50) newHistoryWithDest.shift();
          set({
            previewTab: newPreviewTab,
            navigationHistory: newHistoryWithDest,
            activeTabPath: path,
          });
        } else {
          // Create permanent tab
          const newFileState = createDefaultFileState(
            path,
            content,
            language,
            existingSession,
            initialPosition,
          );

          // Add destination to history and set state
          const destPosition = initialPosition ?? newFileState.cursorPosition;
          const newHistoryWithDest = [...get().navigationHistory, { path, position: destPosition }];
          if (newHistoryWithDest.length > 50) newHistoryWithDest.shift();
          set((s) => ({
            openTabs: [...s.openTabs, path],
            tabStates: { ...s.tabStates, [path]: newFileState },
            navigationHistory: newHistoryWithDest,
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
          filePath: diff.path, // Store original file path for breadcrumb/copy path
        };

        if (isPreview) {
          // Close existing preview if different
          if (
            state.previewTab &&
            state.previewTab.path !== diffPath &&
            isFileTab(state.previewTab)
          ) {
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

      openChatTab: (sessionId, sessionName) => {
        const state = get();
        const chatPath = `chat://${sessionId}`;

        // Check if already open as permanent tab
        if (state.tabStates[chatPath] || state.openTabs.includes(chatPath)) {
          set({ activeTabPath: chatPath });
          return;
        }

        // Check if it's the current preview tab
        if (state.previewTab?.path === chatPath) {
          set({ activeTabPath: chatPath });
          return;
        }

        // Create chat tab (always permanent, not preview)
        const chatTabState: ChatTabState = {
          type: "chat",
          path: chatPath,
          language: "markdown",
          sessionId,
          sessionName,
        };

        set((state) => ({
          openTabs: [...state.openTabs, chatPath],
          tabStates: { ...state.tabStates, [chatPath]: chatTabState },
          activeTabPath: chatPath,
        }));
      },

      registerLazyFileTab: (path: string, fileName: string) => {
        const state = get();

        // Skip if already open
        if (state.openTabs.includes(path) || state.tabStates[path]) {
          return;
        }

        // Detect language from file extension
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const languageMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescriptreact",
          js: "javascript",
          jsx: "javascriptreact",
          json: "json",
          md: "markdown",
          css: "css",
          scss: "scss",
          html: "html",
          py: "python",
          rs: "rust",
          go: "go",
          yaml: "yaml",
          yml: "yaml",
          toml: "toml",
        };
        const language = languageMap[ext] ?? "plaintext";

        const lazyTab: LazyFileTabState = {
          type: "lazy",
          targetType: "file",
          path,
          fileName,
          language,
        };

        set((s) => ({
          openTabs: [...s.openTabs, path],
          tabStates: { ...s.tabStates, [path]: lazyTab },
        }));
      },

      registerLazyDiffTab: (
        path: string,
        fileName: string,
        filePath: string,
        staged: boolean,
      ) => {
        const state = get();

        // Skip if already open
        if (state.openTabs.includes(path) || state.tabStates[path]) {
          return;
        }

        // Detect language from file extension
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
        const languageMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescriptreact",
          js: "javascript",
          jsx: "javascriptreact",
          json: "json",
          md: "markdown",
          css: "css",
          scss: "scss",
          html: "html",
          py: "python",
          rs: "rust",
          go: "go",
          yaml: "yaml",
          yml: "yaml",
          toml: "toml",
        };
        const language = languageMap[ext] ?? "plaintext";

        const lazyTab: LazyDiffTabState = {
          type: "lazy",
          targetType: "diff",
          path,
          fileName,
          filePath,
          staged,
          language,
        };

        set((s) => ({
          openTabs: [...s.openTabs, path],
          tabStates: { ...s.tabStates, [path]: lazyTab },
        }));
      },

      loadLazyTab: (
        path: string,
        content: string,
        language: string,
        headContent?: string | null,
      ) => {
        const state = get();
        const lazyTab = state.tabStates[path];

        // Only load if it's actually a lazy file tab
        if (!lazyTab || lazyTab.type !== "lazy" || lazyTab.targetType !== "file") {
          return;
        }

        // Get existing session data for restoration
        const existingSession = state.sessionData[path];

        const fileTab = createDefaultFileState(
          path,
          content,
          language,
          existingSession,
        );

        // Set head content if provided
        if (headContent !== undefined) {
          fileTab.headContent = headContent;
          if (headContent !== null) {
            fileTab.lineDiff = computeLineDiff(headContent, content);
          }
        }

        set((s) => ({
          tabStates: { ...s.tabStates, [path]: fileTab },
        }));

        // Notify LSP about file open
        notifyFileOpened(path, content).catch(console.error);
      },

      loadLazyDiffTab: (
        path: string,
        originalContent: string,
        modifiedContent: string,
        language: string,
      ) => {
        const state = get();
        const lazyTab = state.tabStates[path];

        // Only load if it's actually a lazy diff tab
        if (!lazyTab || lazyTab.type !== "lazy" || lazyTab.targetType !== "diff") {
          return;
        }

        const diffTab: DiffTabState = {
          type: "diff",
          path,
          fileName: lazyTab.fileName,
          filePath: lazyTab.filePath,
          originalContent,
          modifiedContent,
          staged: lazyTab.staged,
          language,
        };

        set((s) => ({
          tabStates: { ...s.tabStates, [path]: diffTab },
        }));
      },

      isLazyTab: (path: string) => {
        const state = get();
        const tab = state.tabStates[path];
        return tab?.type === "lazy";
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
                  ? (s.openTabs[s.openTabs.length - 1] ?? null)
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
                  ? (s.openTabs[s.openTabs.length - 1] ?? null)
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

        // Keep pinned tabs and the specified tab
        const tabsToKeep = new Set([path, ...state.pinnedTabs]);

        // Close all tabs except pinned ones and the specified one
        for (const tabPath of state.openTabs) {
          if (!tabsToKeep.has(tabPath)) {
            const tabState = state.tabStates[tabPath];
            if (isFileTab(tabState)) {
              notifyFileClosed(tabPath).catch(console.error);
            }
          }
        }

        // Close preview if it's not the specified path (preview can't be pinned)
        if (state.previewTab && state.previewTab.path !== path) {
          if (isFileTab(state.previewTab)) {
            notifyFileClosed(state.previewTab.path).catch(console.error);
          }
        }

        // Build new tab states, keeping only the tabs we want to preserve
        const newTabStates: typeof state.tabStates = {};
        const newOpenTabs: string[] = [];

        for (const tabPath of state.openTabs) {
          if (tabsToKeep.has(tabPath) && state.tabStates[tabPath]) {
            newTabStates[tabPath] = state.tabStates[tabPath];
            newOpenTabs.push(tabPath);
          }
        }

        const keepPreview =
          state.previewTab?.path === path ? state.previewTab : null;

        set({
          openTabs: newOpenTabs,
          tabStates: newTabStates,
          previewTab: keepPreview,
          activeTabPath: path,
        });
      },

      closeAllTabs: () => {
        const state = get();

        // Keep only pinned tabs
        const pinnedSet = new Set(state.pinnedTabs);

        // Notify LSP about closed file tabs (non-pinned only)
        for (const path of state.openTabs) {
          if (!pinnedSet.has(path)) {
            const tabState = state.tabStates[path];
            if (isFileTab(tabState)) {
              notifyFileClosed(path).catch(console.error);
            }
          }
        }
        if (state.previewTab && isFileTab(state.previewTab)) {
          notifyFileClosed(state.previewTab.path).catch(console.error);
        }

        // Build new state keeping only pinned tabs
        const newTabStates: typeof state.tabStates = {};
        const newOpenTabs: string[] = [];

        for (const tabPath of state.openTabs) {
          if (pinnedSet.has(tabPath) && state.tabStates[tabPath]) {
            newTabStates[tabPath] = state.tabStates[tabPath];
            newOpenTabs.push(tabPath);
          }
        }

        // Set active tab to first pinned tab, or null if none
        const newActiveTab = newOpenTabs.length > 0 ? newOpenTabs[0] : null;

        set({
          openTabs: newOpenTabs,
          tabStates: newTabStates,
          previewTab: null,
          activeTabPath: newActiveTab,
        });
      },

      setActiveTab: (path, pushHistory = true, position) => {
        const state = get();

        // Push to navigation history if different from current
        if (pushHistory && path !== state.activeTabPath) {
          const newHistory = [...state.navigationHistory];

          // If we're not at the end of history, truncate forward history
          if (
            state.navigationIndex >= 0 &&
            state.navigationIndex < newHistory.length - 1
          ) {
            newHistory.splice(state.navigationIndex + 1);
          }

          // Get position - use provided position, or get from file state, or default
          const fileState = state.getFileState(path);
          const entryPosition = position ?? fileState?.cursorPosition ?? { line: 1, column: 1 };

          // Create navigation entry
          const newEntry: NavigationEntry = { path, position: entryPosition };

          // Don't push consecutive duplicates (same path and position)
          const lastEntry = newHistory[newHistory.length - 1];
          const isDuplicate = lastEntry &&
            lastEntry.path === path &&
            lastEntry.position.line === entryPosition.line &&
            lastEntry.position.column === entryPosition.column;

          if (!isDuplicate) {
            newHistory.push(newEntry);
            // Limit history to 50 entries
            if (newHistory.length > 50) {
              newHistory.shift();
            }
          }

          set({
            activeTabPath: path,
            navigationHistory: newHistory,
            navigationIndex: -1, // -1 means at the end
          });
        } else {
          set({ activeTabPath: path });
        }
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

          // Ensure we don't move unpinned tabs before pinned tabs
          const pinnedCount = state.pinnedTabs.length;
          const isMovingPinned = state.pinnedTabs.includes(removed);

          let adjustedToIndex = toIndex;
          if (!isMovingPinned && adjustedToIndex < pinnedCount) {
            adjustedToIndex = pinnedCount; // Can't move before pinned tabs
          }
          if (isMovingPinned && adjustedToIndex >= pinnedCount) {
            adjustedToIndex = pinnedCount - 1; // Can't move pinned tabs after unpinned
          }

          newTabs.splice(adjustedToIndex, 0, removed);
          return { openTabs: newTabs };
        });
      },

      pinTab: (path) => {
        set((state) => {
          if (state.pinnedTabs.includes(path)) return state;

          const newPinnedTabs = [...state.pinnedTabs, path];

          // Move pinned tab to the pinned section (before unpinned tabs)
          const newOpenTabs = [...state.openTabs];
          const currentIndex = newOpenTabs.indexOf(path);
          if (currentIndex > -1) {
            newOpenTabs.splice(currentIndex, 1);
            newOpenTabs.splice(state.pinnedTabs.length, 0, path);
          }

          return {
            pinnedTabs: newPinnedTabs,
            openTabs: newOpenTabs,
          };
        });
      },

      unpinTab: (path) => {
        set((state) => {
          const pinIndex = state.pinnedTabs.indexOf(path);
          if (pinIndex === -1) return state;

          const newPinnedTabs = state.pinnedTabs.filter((p) => p !== path);

          // Move unpinned tab to after the remaining pinned tabs
          const newOpenTabs = [...state.openTabs];
          const currentIndex = newOpenTabs.indexOf(path);
          if (currentIndex > -1 && currentIndex < newPinnedTabs.length) {
            newOpenTabs.splice(currentIndex, 1);
            newOpenTabs.splice(newPinnedTabs.length, 0, path);
          }

          return {
            pinnedTabs: newPinnedTabs,
            openTabs: newOpenTabs,
          };
        });
      },

      isTabPinned: (path) => {
        return get().pinnedTabs.includes(path);
      },

      setPinnedTabs: (paths) => {
        set({ pinnedTabs: paths });
      },

      // === NAVIGATION ACTIONS ===

      navigateBack: () => {
        const state = get();
        const history = state.navigationHistory;

        if (history.length < 2) return;

        // Calculate current position
        const currentIndex =
          state.navigationIndex === -1
            ? history.length - 1
            : state.navigationIndex;

        if (currentIndex <= 0) return;

        const newIndex = currentIndex - 1;
        const targetEntry = history[newIndex];

        // Only navigate if tab still exists
        if (
          state.openTabs.includes(targetEntry.path) ||
          state.previewTab?.path === targetEntry.path ||
          state.tabStates[targetEntry.path]
        ) {
          // Update cursor position for the target file
          state.saveCursorPosition(targetEntry.path, targetEntry.position);

          set({
            activeTabPath: targetEntry.path,
            navigationIndex: newIndex,
          });

          // Navigate editor to the position if available
          const editor = state.activeEditor;
          if (editor) {
            // Use setTimeout to ensure the editor has switched
            setTimeout(() => {
              editor.setPosition({
                lineNumber: targetEntry.position.line,
                column: targetEntry.position.column,
              });
              editor.revealLineInCenter(targetEntry.position.line);
              editor.focus();
            }, 0);
          }
        } else {
          // Tab was closed, remove from history and try again
          const newHistory = history.filter((_, i) => i !== newIndex);
          set({ navigationHistory: newHistory });
          get().navigateBack();
        }
      },

      navigateForward: () => {
        const state = get();
        const history = state.navigationHistory;

        if (
          state.navigationIndex === -1 ||
          state.navigationIndex >= history.length - 1
        ) {
          return;
        }

        const newIndex = state.navigationIndex + 1;
        const targetEntry = history[newIndex];

        // Only navigate if tab still exists
        if (
          state.openTabs.includes(targetEntry.path) ||
          state.previewTab?.path === targetEntry.path ||
          state.tabStates[targetEntry.path]
        ) {
          // Update cursor position for the target file
          state.saveCursorPosition(targetEntry.path, targetEntry.position);

          set({
            activeTabPath: targetEntry.path,
            navigationIndex: newIndex === history.length - 1 ? -1 : newIndex,
          });

          // Navigate editor to the position if available
          const editor = state.activeEditor;
          if (editor) {
            // Use setTimeout to ensure the editor has switched
            setTimeout(() => {
              editor.setPosition({
                lineNumber: targetEntry.position.line,
                column: targetEntry.position.column,
              });
              editor.revealLineInCenter(targetEntry.position.line);
              editor.focus();
            }, 0);
          }
        } else {
          // Tab was closed, remove from history and try again
          const newHistory = history.filter((_, i) => i !== newIndex);
          set({ navigationHistory: newHistory });
          get().navigateForward();
        }
      },

      canNavigateBack: () => {
        const state = get();
        const currentIndex =
          state.navigationIndex === -1
            ? state.navigationHistory.length - 1
            : state.navigationIndex;
        return currentIndex > 0;
      },

      canNavigateForward: () => {
        const state = get();
        return (
          state.navigationIndex !== -1 &&
          state.navigationIndex < state.navigationHistory.length - 1
        );
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
              }),
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
        // NOTE: pinnedTabs is persisted per-project in usePersistedIdeState, not here
      }),
    },
  ),
);
