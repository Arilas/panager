/**
 * Rename Provider
 *
 * Enables renaming symbols across files (F2).
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
 * Register rename provider for a language.
 */
export function registerRenameProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerRenameProvider(languageId, {
    async provideRenameEdits(
      model: editor.ITextModel,
      position: Position,
      newName: string,
      _token: CancellationToken
    ) {
      try {
        const edit = await lspApi.lspRename(
          model.uri.path,
          position.lineNumber - 1,
          position.column - 1,
          newName
        );

        const edits: languages.WorkspaceEdit = { edits: [] };

        if (edit.changes) {
          for (const [uri, textEdits] of Object.entries(edit.changes)) {
            for (const textEdit of textEdits) {
              edits.edits.push({
                resource: monaco.Uri.parse(uri),
                textEdit: {
                  range: {
                    startLineNumber: textEdit.range.start.line + 1,
                    startColumn: textEdit.range.start.character + 1,
                    endLineNumber: textEdit.range.end.line + 1,
                    endColumn: textEdit.range.end.character + 1,
                  },
                  text: textEdit.newText,
                },
                versionId: undefined,
              });
            }
          }
        }

        return edits;
      } catch (e) {
        console.error("[LSP] rename error:", e);
        return { edits: [] };
      }
    },
  });
}
