/**
 * Type Definition Provider
 *
 * Enables navigation to the type definition of a symbol.
 * Useful for finding the type of a variable or parameter.
 * Triggered by Ctrl+Shift+F12 or "Go to Type Definition" command.
 */

import type { Monaco } from "@monaco-editor/react";
import type {
  editor,
  Position,
  CancellationToken,
  IDisposable,
} from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import { ensureModelsForUris } from "../fileContentProvider";

/**
 * Register type definition provider for a language.
 */
export function registerTypeDefinitionProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerTypeDefinitionProvider(languageId, {
    async provideTypeDefinition(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ) {
      try {
        const locations = await lspApi.lspTypeDefinition(
          model.uri.path,
          position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          position.column - 1
        );

        // Map to Monaco format
        const monacoLocations = locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));

        // Pre-create models for all referenced files so peek widget can display them
        await ensureModelsForUris(monacoLocations.map((loc) => loc.uri));

        return monacoLocations;
      } catch (e) {
        console.error("[LSP] type_definition error:", e);
        return [];
      }
    },
  });
}
