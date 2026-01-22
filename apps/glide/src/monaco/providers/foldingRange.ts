/**
 * Folding Range Provider
 *
 * Provides custom code folding regions from the LSP.
 * Enables folding for imports, functions, classes, and regions.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, CancellationToken, IDisposable, languages } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import { FoldingRangeKind } from "../../types/lsp";

/**
 * Map LSP folding range kind to Monaco FoldingRangeKind.
 */
function mapFoldingRangeKind(
  monaco: Monaco,
  kind?: string
): languages.FoldingRangeKind | undefined {
  switch (kind) {
    case FoldingRangeKind.Comment:
      return monaco.languages.FoldingRangeKind.Comment;
    case FoldingRangeKind.Imports:
      return monaco.languages.FoldingRangeKind.Imports;
    case FoldingRangeKind.Region:
      return monaco.languages.FoldingRangeKind.Region;
    default:
      return undefined;
  }
}

/**
 * Register folding range provider for a language.
 */
export function registerFoldingRangeProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerFoldingRangeProvider(languageId, {
    async provideFoldingRanges(
      model: editor.ITextModel,
      _context: languages.FoldingContext,
      _token: CancellationToken
    ) {
      try {
        const ranges = await lspApi.lspFoldingRange(model.uri.path);

        return ranges.map((range) => ({
          start: range.startLine + 1, // Monaco is 1-indexed, LSP is 0-indexed
          end: range.endLine + 1,
          kind: mapFoldingRangeKind(monaco, range.kind),
        }));
      } catch (e) {
        console.error("[LSP] folding_range error:", e);
        return [];
      }
    },
  });
}
