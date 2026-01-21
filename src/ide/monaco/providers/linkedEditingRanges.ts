/**
 * Linked Editing Ranges Provider
 *
 * Enables editing paired tags simultaneously (e.g., changing `<div>` updates `</div>`).
 * Useful for JSX/HTML tag editing.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, CancellationToken, IDisposable } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";

/**
 * Register linked editing range provider for a language.
 */
export function registerLinkedEditingRangeProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerLinkedEditingRangeProvider(languageId, {
    async provideLinkedEditingRanges(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ) {
      try {
        const result = await lspApi.lspLinkedEditingRange(
          model.uri.path,
          position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          position.column - 1
        );

        if (!result || result.ranges.length === 0) {
          return null;
        }

        return {
          ranges: result.ranges.map((range) => ({
            startLineNumber: range.start.line + 1,
            startColumn: range.start.character + 1,
            endLineNumber: range.end.line + 1,
            endColumn: range.end.character + 1,
          })),
          wordPattern: result.wordPattern
            ? new RegExp(result.wordPattern)
            : undefined,
        };
      } catch (e) {
        console.error("[LSP] linked_editing_range error:", e);
        return null;
      }
    },
  });
}
