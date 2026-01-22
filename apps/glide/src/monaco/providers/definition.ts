/**
 * Go to Definition Provider
 *
 * Enables Cmd+Click and F12 to navigate to symbol definitions.
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
import { logLspErrorIfNeeded } from "./utils";

/**
 * Register go to definition provider for a language.
 */
export function registerDefinitionProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerDefinitionProvider(languageId, {
    async provideDefinition(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ) {
      try {
        const locations = await lspApi.lspGotoDefinition(
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
        logLspErrorIfNeeded("goto_definition", e);
        return [];
      }
    },
  });
}
