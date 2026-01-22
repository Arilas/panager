/**
 * Hover Provider
 *
 * Shows type information and documentation when hovering over symbols.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, CancellationToken, IDisposable } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";

/**
 * Register hover provider for a language.
 */
export function registerHoverProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerHoverProvider(languageId, {
    async provideHover(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ) {
      try {
        console.log("[LSP] hover request:", model.uri.path, position.lineNumber - 1, position.column - 1);
        const hover = await lspApi.lspHover(
          model.uri.path,
          position.lineNumber - 1,
          position.column - 1
        );

        console.log("[LSP] hover response:", hover);

        if (!hover) return null;

        return {
          contents: [
            {
              value: hover.contents.value,
              isTrusted: true,
            },
          ],
          range: hover.range
            ? {
                startLineNumber: hover.range.start.line + 1,
                startColumn: hover.range.start.character + 1,
                endLineNumber: hover.range.end.line + 1,
                endColumn: hover.range.end.character + 1,
              }
            : undefined,
        };
      } catch (e) {
        console.error("[LSP] hover error:", e);
        return null;
      }
    },
  });
}
