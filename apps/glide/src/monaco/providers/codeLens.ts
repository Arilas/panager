/**
 * CodeLens Provider for Git Blame
 *
 * Shows "Last modified by X, Y ago" above function/class declarations.
 * Reads data directly from editorStore (store-driven pattern).
 */

import type { Monaco } from "@monaco-editor/react";
import type {
  editor,
  languages,
  IDisposable,
  CancellationToken,
  Emitter,
} from "monaco-editor";
import { useEditorStore } from "../../stores/editor";
import { useIdeSettingsStore } from "../../stores/settings";
import type { GitBlameLine } from "../../types";
import { LSP_LANGUAGES } from "./index";

// Module-level emitter for triggering refreshes
let globalEmitter: Emitter<languages.CodeLensProvider> | null = null;
let globalProviderDisposable: IDisposable | null = null;

/**
 * Format a timestamp as relative time (e.g., "3 days ago").
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
 * Register the CodeLens blame provider.
 * Reads blame/symbol data directly from editorStore.
 */
export function registerCodeLensProvider(monaco: Monaco): IDisposable {
  if (globalProviderDisposable) return globalProviderDisposable;

  // Create emitter for triggering refreshes
  const emitter = new monaco.Emitter<languages.CodeLensProvider>();
  globalEmitter = emitter;

  const provider: languages.CodeLensProvider = {
    onDidChange: emitter.event,

    provideCodeLenses(
      model: editor.ITextModel,
      _token: CancellationToken
    ): languages.ProviderResult<languages.CodeLensList> {
      const filePath = model.uri.path;

      // Check if CodeLens is enabled from settings store
      const codeLensEnabled = useIdeSettingsStore.getState().settings.git.codeLens.enabled;
      if (!codeLensEnabled) {
        return { lenses: [], dispose: () => {} };
      }

      // Get file state from editor store
      const fileState = useEditorStore.getState().getFileState(filePath);
      if (!fileState || !fileState.blameData || fileState.symbols.length === 0) {
        return { lenses: [], dispose: () => {} };
      }

      const { symbols, blameData, lineDiff } = fileState;
      const lenses: languages.CodeLens[] = [];

      for (const symbol of symbols) {
        // Get the current line number for the symbol (LSP is 0-indexed)
        const currentLineNumber = symbol.selectionRange.start.line + 1;

        let blameText: string;
        let tooltip: string;

        if (lineDiff) {
          // Use virtual diff to map current line to original line
          const mapping = lineDiff.mappings[currentLineNumber - 1];

          if (
            !mapping ||
            mapping.status === "added" ||
            mapping.status === "modified"
          ) {
            // New or modified symbol - show uncommitted indicator
            blameText = "You • Uncommitted";
            tooltip = "This symbol has uncommitted changes";
          } else if (mapping.originalLine !== null) {
            // Unchanged line - map to original line and get blame
            const blameLine = blameData.lines.find(
              (l: GitBlameLine) => l.lineNumber === mapping.originalLine
            );
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
          const blameLine = blameData.lines.find(
            (l: GitBlameLine) => l.lineNumber === currentLineNumber
          );
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

    resolveCodeLens(
      _model: editor.ITextModel,
      codeLens: languages.CodeLens,
      _token: CancellationToken
    ): languages.ProviderResult<languages.CodeLens> {
      return codeLens;
    },
  };

  // Register for all LSP languages
  const disposables: IDisposable[] = [];
  for (const lang of LSP_LANGUAGES) {
    disposables.push(monaco.languages.registerCodeLensProvider(lang, provider));
  }

  // Create a combined disposable
  globalProviderDisposable = {
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
      globalEmitter?.dispose();
      globalEmitter = null;
      globalProviderDisposable = null;
    },
  };

  console.log(
    "[Monaco] Registered CodeLens provider for languages:",
    LSP_LANGUAGES.join(", ")
  );

  return globalProviderDisposable;
}

/**
 * Trigger a CodeLens refresh (call when blame/symbols update in store).
 */
export function triggerCodeLensRefresh(): void {
  if (globalEmitter) {
    // Fire with null to trigger refresh
    globalEmitter.fire(null as unknown as languages.CodeLensProvider);
  }
}
