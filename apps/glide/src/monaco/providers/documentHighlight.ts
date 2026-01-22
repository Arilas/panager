/**
 * Document Highlight Provider
 *
 * Highlights all occurrences of the symbol under cursor.
 * Read-access highlights show differently from write-access.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, CancellationToken, IDisposable } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import { DocumentHighlightKind } from "../../types/lsp";
import { logLspErrorIfNeeded } from "./utils";

/**
 * Map LSP DocumentHighlightKind to Monaco DocumentHighlightKind.
 */
function mapHighlightKind(
  monaco: Monaco,
  kind?: number
): import("monaco-editor").languages.DocumentHighlightKind {
  switch (kind) {
    case DocumentHighlightKind.Read:
      return monaco.languages.DocumentHighlightKind.Read;
    case DocumentHighlightKind.Write:
      return monaco.languages.DocumentHighlightKind.Write;
    case DocumentHighlightKind.Text:
    default:
      return monaco.languages.DocumentHighlightKind.Text;
  }
}

/**
 * Register document highlight provider for a language.
 */
export function registerDocumentHighlightProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerDocumentHighlightProvider(languageId, {
    async provideDocumentHighlights(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ) {
      try {
        const highlights = await lspApi.lspDocumentHighlight(
          model.uri.path,
          position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          position.column - 1
        );

        return highlights.map((highlight) => ({
          range: {
            startLineNumber: highlight.range.start.line + 1,
            startColumn: highlight.range.start.character + 1,
            endLineNumber: highlight.range.end.line + 1,
            endColumn: highlight.range.end.character + 1,
          },
          kind: mapHighlightKind(monaco, highlight.kind),
        }));
      } catch (e) {
        logLspErrorIfNeeded("document_highlight", e);
        return [];
      }
    },
  });
}
