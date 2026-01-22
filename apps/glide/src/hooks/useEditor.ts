/**
 * useEditor Hook
 *
 * Thin React integration for Monaco editor.
 * Handles:
 * - Editor mount with session restoration
 * - Decoration manager attachment
 * - Cursor/scroll position tracking
 * - Loading data for the file (blame, symbols, HEAD content)
 */

import { useCallback, useEffect, useRef } from "react";
import type { editor, IDisposable } from "monaco-editor";
import type { Monaco, OnMount } from "@monaco-editor/react";
import { useMonacoStore } from "../stores/monaco";
import { useTabsStore } from "../stores/tabs";
import { useIdeStore } from "../stores/ide";
import {
  blameWidgetManager,
  gutterDecorationManager,
  isMonacoReady,
} from "../monaco";
import { gitBlame, gitShowHead, lspDocumentSymbols } from "../lib/tauri-ide";
import { buildFileUrl } from "../lib/tabs/url";
import { computeLineDiff } from "../lib/lineDiff";
import { SymbolKind, type LspDocumentSymbol } from "../types/lsp";
import type { FileTabData } from "../lib/tabs/types";

interface UseEditorOptions {
  filePath: string;
  groupId: string;
  language: string;
}

// Symbol kinds that should show blame CodeLens
const BLAME_SYMBOL_KINDS: Set<number> = new Set([
  SymbolKind.Class,
  SymbolKind.Interface,
  SymbolKind.Function,
  SymbolKind.Method,
  SymbolKind.Constructor,
  SymbolKind.Enum,
  SymbolKind.Struct,
]);

// Languages that support document symbols via LSP
const SUPPORTED_LANGUAGES = new Set([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "tsx",
  "jsx",
]);

/**
 * Flatten nested document symbols, keeping only blameable ones.
 */
function flattenBlameableSymbols(
  symbols: LspDocumentSymbol[],
  result: LspDocumentSymbol[] = []
): LspDocumentSymbol[] {
  for (const symbol of symbols) {
    if (BLAME_SYMBOL_KINDS.has(symbol.kind)) {
      result.push(symbol);
    }
    if (symbol.children) {
      flattenBlameableSymbols(symbol.children, result);
    }
  }
  return result;
}

/**
 * Load blame data for a file.
 */
async function loadBlameData(filePath: string, groupId: string): Promise<void> {
  const projectContext = useIdeStore.getState().projectContext;
  if (!projectContext) return;

  const store = useMonacoStore.getState();

  // Check if already loading
  const metadata = store.getEditorMetadata(filePath, groupId);
  if (metadata?.blameLoading || metadata?.blameData) return;

  store.setBlameLoading(filePath, groupId, true);

  try {
    const blameResult = await gitBlame(projectContext.projectPath, filePath);
    store.setBlameData(filePath, groupId, blameResult);
  } catch (error) {
    console.error("[useEditor] Failed to load blame:", error);
    store.setBlameLoading(filePath, groupId, false);
  }
}

/**
 * Load HEAD content and compute line diff.
 */
async function loadHeadContentAndDiff(filePath: string, groupId: string): Promise<void> {
  const projectContext = useIdeStore.getState().projectContext;
  if (!projectContext) return;

  const tabsStore = useTabsStore.getState();
  const monacoStore = useMonacoStore.getState();

  // Get the tab to check current content
  const url = buildFileUrl(filePath);
  const tabInfo = tabsStore.findTabInGroup(url, groupId);
  if (!tabInfo?.resolved) return;

  const tabData = tabInfo.resolved.data as FileTabData;

  // If we already have headContent in the tab, compute diff directly
  if (tabData.headContent !== null) {
    const lineDiff = computeLineDiff(tabData.headContent, tabData.currentContent);
    monacoStore.setLineDiff(filePath, groupId, lineDiff);
    return;
  }

  // Otherwise load HEAD content
  try {
    const headContent = await gitShowHead(projectContext.projectPath, filePath);
    // Use empty string for new files (not in HEAD)
    const content = headContent ?? "";

    // Update the tab's headContent
    tabsStore.updateHeadContent(url, content);

    // Compute and store line diff
    const lineDiff = computeLineDiff(content, tabData.currentContent);
    monacoStore.setLineDiff(filePath, groupId, lineDiff);
  } catch (error) {
    console.error("[useEditor] Failed to load HEAD content:", error);
  }
}

/**
 * Load document symbols for a file.
 */
async function loadSymbols(filePath: string, groupId: string, language: string): Promise<void> {
  if (!SUPPORTED_LANGUAGES.has(language)) return;

  const store = useMonacoStore.getState();

  // Check if already loading or have symbols
  const metadata = store.getEditorMetadata(filePath, groupId);
  if (
    metadata?.symbolsLoading ||
    (metadata?.symbols && metadata.symbols.length > 0)
  ) {
    return;
  }

  store.setSymbolsLoading(filePath, groupId, true);

  // Retry logic for LSP timing
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await lspDocumentSymbols(filePath);
      const flattened = flattenBlameableSymbols(result);

      if (flattened.length > 0 || attempt === maxRetries - 1) {
        store.setSymbols(filePath, groupId, flattened);
        console.log(
          "[useEditor] Loaded",
          flattened.length,
          "symbols for",
          filePath
        );
        return;
      }

      // Wait and retry (LSP might not have processed didOpen yet)
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error("[useEditor] Failed to load symbols:", error);
        store.setSymbolsLoading(filePath, groupId, false);
      }
    }
  }
}

/**
 * Load all editor data for a file (blame, HEAD content, symbols).
 */
function loadFileEditorData(filePath: string, groupId: string, language: string): void {
  // Ensure metadata exists
  useMonacoStore.getState().ensureEditorMetadata(filePath, groupId);

  // Load in parallel
  loadBlameData(filePath, groupId);
  loadHeadContentAndDiff(filePath, groupId);
  loadSymbols(filePath, groupId, language);
}

/**
 * Hook for Monaco editor integration.
 */
export function useEditor({ filePath, groupId, language }: UseEditorOptions) {
  const initStatus = useMonacoStore((s) => s.initState.status);
  const setActiveEditor = useMonacoStore((s) => s.setActiveEditor);
  const updateCursorPosition = useTabsStore((s) => s.updateCursorPosition);
  const updateScrollPosition = useTabsStore((s) => s.updateScrollPosition);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);

  const scrollTimeoutRef = useRef<number | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  // Get the tab URL for position updates
  const url = buildFileUrl(filePath);

  const handleMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editorInstance;

      // Store the editor reference
      setActiveEditor(editorInstance);

      // Attach decoration managers
      blameWidgetManager.attach(editorInstance, filePath, groupId);
      gutterDecorationManager.attach(editorInstance, filePath, groupId);

      // Restore session state from tabs store
      const tabsStore = useTabsStore.getState();
      const tabInfo = tabsStore.findTabInGroup(url, groupId);
      if (tabInfo) {
        const { cursorPosition, scrollPosition } = tabInfo;

        // Restore cursor position
        if (cursorPosition) {
          editorInstance.setPosition({
            lineNumber: cursorPosition.line,
            column: cursorPosition.column,
          });
        }

        // Restore scroll position
        if (scrollPosition) {
          editorInstance.setScrollPosition({
            scrollTop: scrollPosition.top,
            scrollLeft: scrollPosition.left,
          });
        }

        // Reveal the cursor line
        if (cursorPosition) {
          editorInstance.revealLineInCenter(cursorPosition.line);
        }
      }

      // Clear any previous disposables
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];

      // Track cursor position changes
      const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
        // Update tabs store (for session persistence)
        updateCursorPosition(url, {
          line: e.position.lineNumber,
          column: e.position.column,
        });

        // Update IDE store (for status bar)
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });
      disposablesRef.current.push(cursorDisposable);

      // Track scroll position changes (debounced)
      const scrollDisposable = editorInstance.onDidScrollChange((e) => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = window.setTimeout(() => {
          updateScrollPosition(url, {
            top: e.scrollTop,
            left: e.scrollLeft,
          });
        }, 100);
      });
      disposablesRef.current.push(scrollDisposable);

      // Set initial cursor position in IDE store
      const pos = editorInstance.getPosition();
      if (pos) {
        setCursorPosition({
          line: pos.lineNumber,
          column: pos.column,
        });
      }

      // Load data for this file (blame, symbols, HEAD content)
      loadFileEditorData(filePath, groupId, language);

      // Focus the editor
      editorInstance.focus();
    },
    [
      filePath,
      groupId,
      language,
      url,
      setActiveEditor,
      updateCursorPosition,
      updateScrollPosition,
      setCursorPosition,
    ]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Dispose editor event listeners
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];

      // Detach decoration managers
      blameWidgetManager.detach();
      gutterDecorationManager.detach();

      // Clear editor reference
      setActiveEditor(null);
      editorRef.current = null;
    };
  }, [setActiveEditor]);

  // Reattach decoration managers when file path changes
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      blameWidgetManager.attach(editor, filePath, groupId);
      gutterDecorationManager.attach(editor, filePath, groupId);
      loadFileEditorData(filePath, groupId, language);
    }
  }, [filePath, groupId, language]);

  return {
    onMount: handleMount,
    isReady: initStatus === "ready" || isMonacoReady(),
    isLoading: initStatus === "loading",
    hasError: initStatus === "error",
  };
}
