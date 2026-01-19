/**
 * Hook for Git Blame CodeLens in Monaco editor
 *
 * Shows "Last modified by X, Y ago" above function/class declarations.
 * Uses document symbols from LSP combined with git blame data.
 *
 * Features:
 * - Shows blame for unchanged symbols (mapped through virtual diff)
 * - Shows "You • Uncommitted" for new/modified symbols
 * - Updates in real-time as you edit without blinking
 * - Optimistic position updates based on line diff
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { editor, languages, IDisposable, CancellationToken, Emitter } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useIdeStore } from "../stores/ide";
import { useGitStore } from "../stores/git";
import { useFilesStore } from "../stores/files";
import { useLineDiff } from "./useLineDiff";
import * as lspApi from "../lib/tauri-ide";
import { SymbolKind, type LspDocumentSymbol } from "../types/lsp";
import type { LineDiffResult } from "../lib/lineDiff";
import type { GitBlameResult } from "../types";

interface UseCodeLensBlameOptions {
  editor: editor.IStandaloneCodeEditor | null;
  monaco: Monaco | null;
  filePath: string;
  language: string;
  enabled?: boolean;
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
]);

/**
 * Format a timestamp as relative time (e.g., "3 days ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}

/**
 * Flatten nested document symbols, keeping only blameable ones
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
 * Compute line offset at a given original line based on diff mappings.
 * Returns how many lines have been added (positive) or removed (negative)
 * before the given original line.
 */
function computeLineOffset(lineDiff: LineDiffResult, originalLine: number): number {
  // Count how many current lines map to original lines < originalLine
  // vs how many original lines exist before originalLine
  let currentLinesBeforeOriginal = 0;

  for (const mapping of lineDiff.mappings) {
    if (mapping.originalLine !== null && mapping.originalLine < originalLine) {
      currentLinesBeforeOriginal++;
    } else if (mapping.originalLine !== null && mapping.originalLine >= originalLine) {
      break;
    } else if (mapping.status === "added") {
      // Added line before this original line
      currentLinesBeforeOriginal++;
    }
  }

  // The offset is the difference between current position and original position
  return currentLinesBeforeOriginal - (originalLine - 1);
}

/**
 * Adjust symbol positions based on line diff.
 * This provides optimistic updates before LSP responds with fresh symbols.
 */
function adjustSymbolPositions(
  symbols: LspDocumentSymbol[],
  lineDiff: LineDiffResult
): LspDocumentSymbol[] {
  return symbols.map((symbol) => {
    // Get the original line number (symbols have 0-indexed lines)
    const originalLine = symbol.range.start.line + 1;

    // Find the current line for this original line
    // Look through mappings to find where this original line is now
    let newLine = originalLine;

    for (let i = 0; i < lineDiff.mappings.length; i++) {
      const mapping = lineDiff.mappings[i];
      if (mapping.originalLine === originalLine) {
        newLine = mapping.currentLine;
        break;
      }
    }

    // If the original line wasn't found in mappings, estimate the new position
    if (newLine === originalLine) {
      const offset = computeLineOffset(lineDiff, originalLine);
      newLine = originalLine + offset;
    }

    // Adjust line numbers (convert back to 0-indexed)
    const lineDelta = newLine - originalLine;

    return {
      ...symbol,
      range: {
        ...symbol.range,
        start: { ...symbol.range.start, line: symbol.range.start.line + lineDelta },
        end: { ...symbol.range.end, line: symbol.range.end.line + lineDelta },
      },
      selectionRange: {
        ...symbol.selectionRange,
        start: { ...symbol.selectionRange.start, line: symbol.selectionRange.start.line + lineDelta },
        end: { ...symbol.selectionRange.end, line: symbol.selectionRange.end.line + lineDelta },
      },
    };
  });
}

/** Data needed by CodeLens provider, stored in refs to avoid re-registration */
interface CodeLensData {
  symbols: LspDocumentSymbol[];
  blameData: GitBlameResult | null;
  lineDiff: LineDiffResult | null;
}

/**
 * Hook that registers a CodeLens provider showing git blame above symbols
 */
export function useCodeLensBlame({
  editor,
  monaco,
  filePath,
  language,
  enabled = true,
}: UseCodeLensBlameOptions) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const { loadBlame, blameCache, blameLoading, refreshBlameForFile } = useGitStore();

  // Track file dirty state for refresh on save
  const openFile = useFilesStore((s) => s.openFiles.find((f) => f.path === filePath));
  const isDirty = openFile?.isDirty ?? false;

  const providerRef = useRef<IDisposable | null>(null);
  const lastFilePathRef = useRef<string | null>(null);
  const wasDirtyRef = useRef<boolean>(false);

  // Store current data in refs so provider can access latest without re-registration
  const dataRef = useRef<CodeLensData>({
    symbols: [],
    blameData: null,
    lineDiff: null,
  });

  // Event emitter to trigger CodeLens refresh (Monaco API pattern)
  const emitterRef = useRef<Emitter<languages.CodeLensProvider> | null>(null);
  const providerObjRef = useRef<languages.CodeLensProvider | null>(null);

  // Base symbols from LSP (at the time they were loaded)
  const [baseSymbols, setBaseSymbols] = useState<LspDocumentSymbol[]>([]);

  // Get blame data
  const blameData = blameCache[filePath];

  // Use shared line diff hook
  const { lineDiff } = useLineDiff({ filePath });

  // Optimistically adjust symbol positions based on line diff
  // This prevents blinking when lines are added/removed
  const adjustedSymbols = useMemo<LspDocumentSymbol[]>(() => {
    if (!lineDiff || baseSymbols.length === 0) {
      return baseSymbols;
    }
    // Only adjust if content has changed
    if (!lineDiff.hasChanges) {
      return baseSymbols;
    }
    return adjustSymbolPositions(baseSymbols, lineDiff);
  }, [baseSymbols, lineDiff]);

  // Update data ref when data changes and trigger refresh via onDidChange event
  useEffect(() => {
    const newData: CodeLensData = {
      symbols: adjustedSymbols,
      blameData: blameData ?? null,
      lineDiff,
    };

    // Check if data actually changed
    const oldData = dataRef.current;
    const symbolsChanged = newData.symbols !== oldData.symbols;
    const blameChanged = newData.blameData !== oldData.blameData;
    const diffChanged = newData.lineDiff !== oldData.lineDiff;

    if (symbolsChanged || blameChanged || diffChanged) {
      dataRef.current = newData;
      // Fire the onDidChange event to trigger Monaco to re-request CodeLenses
      if (emitterRef.current && providerObjRef.current) {
        emitterRef.current.fire(providerObjRef.current);
      }
    }
  }, [adjustedSymbols, blameData, lineDiff]);

  // Load symbols for the current file (with retry for LSP timing)
  const loadSymbols = useCallback(async (retryCount = 0) => {
    if (!SUPPORTED_LANGUAGES.has(language)) {
      setBaseSymbols([]);
      return;
    }

    try {
      const result = await lspApi.lspDocumentSymbols(filePath);
      const flattened = flattenBlameableSymbols(result);

      // If no symbols and haven't retried yet, wait and retry
      // (LSP might not have processed didOpen yet)
      if (flattened.length === 0 && retryCount < 3) {
        console.log("[CodeLensBlame] No symbols, retrying in 500ms (attempt", retryCount + 1, ")");
        setTimeout(() => loadSymbols(retryCount + 1), 500);
        return;
      }

      setBaseSymbols(flattened);
      console.log("[CodeLensBlame] Loaded", flattened.length, "symbols for", filePath);
    } catch (error) {
      console.error("[CodeLensBlame] Failed to load symbols:", error);
      // Retry on error (LSP might not be ready)
      if (retryCount < 3) {
        console.log("[CodeLensBlame] Error, retrying in 500ms (attempt", retryCount + 1, ")");
        setTimeout(() => loadSymbols(retryCount + 1), 500);
        return;
      }
      setBaseSymbols([]);
    }
  }, [filePath, language]);

  // Load blame data for the file
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Load blame if not cached (will also fetch HEAD content for diff)
    if (!blameCache[filePath] && !blameLoading[filePath]) {
      loadBlame(projectContext.projectPath, filePath);
    }
  }, [enabled, projectContext, filePath, blameCache, blameLoading, loadBlame]);

  // Load symbols when file changes
  useEffect(() => {
    if (!enabled || !filePath) return;

    if (filePath !== lastFilePathRef.current) {
      lastFilePathRef.current = filePath;
      loadSymbols();
    }
  }, [enabled, filePath, loadSymbols]);

  // Refresh blame on save
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Detect save: was dirty, now clean - refresh blame and symbols
    if (wasDirtyRef.current && !isDirty) {
      console.log("[CodeLensBlame] File saved, refreshing blame for:", filePath);
      refreshBlameForFile(projectContext.projectPath, filePath);
      // Also reload symbols as they may have changed
      loadSymbols();
    }

    // Update the ref for next comparison
    wasDirtyRef.current = isDirty;
  }, [enabled, projectContext, filePath, isDirty, refreshBlameForFile, loadSymbols]);

  // Register CodeLens provider ONCE and use refs for data + onDidChange for updates
  useEffect(() => {
    if (!editor || !monaco || !enabled || !SUPPORTED_LANGUAGES.has(language)) {
      return;
    }

    console.log("[CodeLensBlame] Registering provider for language:", language);

    // Dispose previous provider and emitter
    if (providerRef.current) {
      providerRef.current.dispose();
      providerRef.current = null;
    }
    if (emitterRef.current) {
      emitterRef.current.dispose();
      emitterRef.current = null;
    }

    // Create emitter for onDidChange events
    // Monaco's Emitter class is used to trigger CodeLens refresh
    const emitter = new monaco.Emitter<languages.CodeLensProvider>();
    emitterRef.current = emitter;

    // Create provider that reads from dataRef
    const provider: languages.CodeLensProvider = {
      // This event triggers Monaco to re-call provideCodeLenses
      onDidChange: emitter.event,

      provideCodeLenses: (
        _model: editor.ITextModel,
        _token: CancellationToken
      ): languages.ProviderResult<languages.CodeLensList> => {
        const { symbols, blameData: currentBlameData, lineDiff: currentLineDiff } = dataRef.current;

        if (symbols.length === 0 || !currentBlameData) {
          return { lenses: [], dispose: () => {} };
        }

        const lenses: languages.CodeLens[] = [];

        for (const symbol of symbols) {
          // Get the current line number for the symbol (LSP is 0-indexed)
          const currentLineNumber = symbol.selectionRange.start.line + 1;

          let blameText: string;
          let tooltip: string;

          if (currentLineDiff) {
            // Use virtual diff to map current line to original line
            const mapping = currentLineDiff.mappings[currentLineNumber - 1];

            if (!mapping || mapping.status === "added" || mapping.status === "modified") {
              // New or modified symbol - show uncommitted indicator
              blameText = "You • Uncommitted";
              tooltip = "This symbol has uncommitted changes";
            } else if (mapping.originalLine !== null) {
              // Unchanged line - map to original line and get blame
              const blameLine = currentBlameData.lines.find((l) => l.lineNumber === mapping.originalLine);
              if (blameLine) {
                blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)}`;
                tooltip = `${blameLine.summary}\n\nCommit: ${blameLine.commitId.substring(0, 8)}`;
              } else {
                continue; // Skip if no blame data
              }
            } else {
              continue;
            }
          } else {
            // No diff computed yet, use direct line lookup
            const blameLine = currentBlameData.lines.find(l => l.lineNumber === currentLineNumber);
            if (!blameLine) continue;

            blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)}`;
            tooltip = `${blameLine.summary}\n\nCommit: ${blameLine.commitId.substring(0, 8)}`;
          }

          lenses.push({
            range: {
              startLineNumber: symbol.range.start.line + 1,
              startColumn: 1,
              endLineNumber: symbol.range.start.line + 1,
              endColumn: 1,
            },
            command: {
              id: "",
              title: `$(git-commit) ${blameText}`,
              tooltip,
            },
          });
        }

        return { lenses, dispose: () => {} };
      },

      resolveCodeLens: (
        _model: editor.ITextModel,
        codeLens: languages.CodeLens,
        _token: CancellationToken
      ): languages.ProviderResult<languages.CodeLens> => {
        return codeLens;
      },
    };

    providerObjRef.current = provider;
    providerRef.current = monaco.languages.registerCodeLensProvider(language, provider);

    return () => {
      if (providerRef.current) {
        providerRef.current.dispose();
        providerRef.current = null;
      }
      if (emitterRef.current) {
        emitterRef.current.dispose();
        emitterRef.current = null;
      }
      providerObjRef.current = null;
    };
  }, [editor, monaco, enabled, language, filePath]); // Only re-register on editor/language/file change

  return {
    isLoading: blameLoading[filePath] ?? false,
    hasBlame: !!blameCache[filePath],
    symbolCount: baseSymbols.length,
    lineDiff,
  };
}
