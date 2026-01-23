/**
 * Selection Range Provider
 *
 * Provides smart selection expansion (Shift+Alt+Right expands selection semantically).
 * Returns nested ranges for progressive selection.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, CancellationToken, IDisposable, languages } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import type { LspSelectionRange } from "../../types/lsp";
import { logLspErrorIfNeeded } from "./utils";

/**
 * Flatten a nested LSP SelectionRange into an array of Monaco SelectionRanges.
 * Monaco expects an array where each element's range is the parent of the previous.
 */
function flattenSelectionRange(
  lspRange: LspSelectionRange
): languages.SelectionRange[] {
  const result: languages.SelectionRange[] = [];
  let current: LspSelectionRange | undefined = lspRange;

  while (current) {
    result.push({
      range: {
        startLineNumber: current.range.start.line + 1,
        startColumn: current.range.start.character + 1,
        endLineNumber: current.range.end.line + 1,
        endColumn: current.range.end.character + 1,
      },
    });
    current = current.parent;
  }

  return result;
}

/**
 * Register selection range provider for a language.
 */
export function registerSelectionRangeProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerSelectionRangeProvider(languageId, {
    async provideSelectionRanges(
      model: editor.ITextModel,
      positions: Position[],
      _token: CancellationToken
    ): Promise<languages.SelectionRange[][]> {
      try {
        // Convert Monaco positions to LSP positions
        const lspPositions = positions.map((pos) => ({
          line: pos.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          character: pos.column - 1,
        }));

        const ranges = await lspApi.lspSelectionRange(model.uri.path, lspPositions);

        // Convert each LSP selection range to Monaco format (one array per position)
        return ranges.map((range) => flattenSelectionRange(range));
      } catch (e) {
        logLspErrorIfNeeded("selection_range", e);
        // Return empty arrays for each position
        return positions.map(() => []);
      }
    },
  });
}
