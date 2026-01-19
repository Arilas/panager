/**
 * Find References Provider
 *
 * Shows all references to a symbol (Shift+F12).
 */

import type { Monaco } from "@monaco-editor/react";
import type {
  editor,
  Position,
  CancellationToken,
  IDisposable,
  languages,
} from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";

/**
 * Register references provider for a language.
 */
export function registerReferencesProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerReferenceProvider(languageId, {
    async provideReferences(
      model: editor.ITextModel,
      position: Position,
      context: languages.ReferenceContext,
      _token: CancellationToken
    ) {
      try {
        const locations = await lspApi.lspReferences(
          model.uri.path,
          position.lineNumber - 1,
          position.column - 1,
          context.includeDeclaration
        );

        return locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("[LSP] references error:", e);
        return [];
      }
    },
  });
}
