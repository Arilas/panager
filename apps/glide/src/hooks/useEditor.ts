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
import { useIdeStore } from "../stores/ide";
import {
  blameWidgetManager,
  gutterDecorationManager,
  isMonacoReady,
} from "../monaco";
import { gitBlame, gitShowHead, lspDocumentSymbols } from "../lib/tauri-ide";
import { SymbolKind, type LspDocumentSymbol } from "../types/lsp";

interface UseEditorOptions {
  filePath: string;
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
  result: LspDocumentSymbol[] = [],
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
async function loadBlameData(filePath: string): Promise<void> {
  const projectContext = useIdeStore.getState().projectContext;
  if (!projectContext) return;

  const store = useMonacoStore.getState();

  // Check if already loading
  const fileState = store.getFileState(filePath);
  if (fileState?.blameLoading || fileState?.blameData) return;

  store.setBlameLoading(filePath, true);

  try {
    const blameResult = await gitBlame(projectContext.projectPath, filePath);
    store.setBlameData(filePath, blameResult);
  } catch (error) {
    console.error("[useEditor] Failed to load blame:", error);
    store.setBlameLoading(filePath, false);
  }
}

/**
 * Load HEAD content for a file (for diff computation).
 */
async function loadHeadContent(filePath: string): Promise<void> {
  const projectContext = useIdeStore.getState().projectContext;
  if (!projectContext) return;

  const store = useMonacoStore.getState();

  // Check if already have HEAD content
  const fileState = store.getFileState(filePath);
  if (fileState?.headContent !== null) return;

  try {
    const content = await gitShowHead(projectContext.projectPath, filePath);
    // Use empty string for new files (not in HEAD)
    store.setHeadContent(filePath, content ?? "");
  } catch (error) {
    console.error("[useEditor] Failed to load HEAD content:", error);
  }
}

/**
 * Load document symbols for a file.
 */
async function loadSymbols(filePath: string, language: string): Promise<void> {
  if (!SUPPORTED_LANGUAGES.has(language)) return;

  const store = useMonacoStore.getState();

  // Check if already loading or have symbols
  const fileState = store.getFileState(filePath);
  if (
    fileState?.symbolsLoading ||
    (fileState?.symbols && fileState.symbols.length > 0)
  ) {
    return;
  }

  store.setSymbolsLoading(filePath, true);

  // Retry logic for LSP timing
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await lspDocumentSymbols(filePath);
      const flattened = flattenBlameableSymbols(result);

      if (flattened.length > 0 || attempt === maxRetries - 1) {
        store.setSymbols(filePath, flattened);
        console.log(
          "[useEditor] Loaded",
          flattened.length,
          "symbols for",
          filePath,
        );
        return;
      }

      // Wait and retry (LSP might not have processed didOpen yet)
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error("[useEditor] Failed to load symbols:", error);
        store.setSymbolsLoading(filePath, false);
      }
    }
  }
}

/**
 * Load all editor data for a file (blame, HEAD content, symbols).
 */
function loadFileEditorData(filePath: string, language: string): void {
  // Load in parallel
  loadBlameData(filePath);
  loadHeadContent(filePath);
  loadSymbols(filePath, language);
}

/**
 * Hook for Monaco editor integration.
 */
export function useEditor({ filePath, language }: UseEditorOptions) {
  const initStatus = useMonacoStore((s) => s.initState.status);
  const setActiveEditor = useMonacoStore((s) => s.setActiveEditor);
  const saveCursorPosition = useMonacoStore((s) => s.saveCursorPosition);
  const saveScrollPosition = useMonacoStore((s) => s.saveScrollPosition);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);

  const scrollTimeoutRef = useRef<number | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  const handleMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editorInstance;

      // Store the editor reference
      setActiveEditor(editorInstance);

      // Attach decoration managers
      blameWidgetManager.attach(editorInstance, filePath);
      gutterDecorationManager.attach(editorInstance, filePath);

      // Restore session state
      const fileState = useMonacoStore.getState().getFileState(filePath);
      if (fileState) {
        // Restore cursor position
        editorInstance.setPosition({
          lineNumber: fileState.cursorPosition.line,
          column: fileState.cursorPosition.column,
        });

        // Restore scroll position
        editorInstance.setScrollPosition({
          scrollTop: fileState.scrollPosition.top,
          scrollLeft: fileState.scrollPosition.left,
        });

        // Reveal the cursor line
        editorInstance.revealLineInCenter(fileState.cursorPosition.line);
      }

      // Clear any previous disposables
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];

      // Track cursor position changes
      const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
        // Update editor store (for session persistence)
        saveCursorPosition(filePath, {
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
          saveScrollPosition(filePath, {
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
      loadFileEditorData(filePath, language);

      // Focus the editor
      editorInstance.focus();
    },
    [
      filePath,
      language,
      setActiveEditor,
      saveCursorPosition,
      saveScrollPosition,
      setCursorPosition,
    ],
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
      blameWidgetManager.attach(editor, filePath);
      gutterDecorationManager.attach(editor, filePath);
      loadFileEditorData(filePath, language);
    }
  }, [filePath, language]);

  return {
    onMount: handleMount,
    isReady: initStatus === "ready" || isMonacoReady(),
    isLoading: initStatus === "loading",
    hasError: initStatus === "error",
  };
}
