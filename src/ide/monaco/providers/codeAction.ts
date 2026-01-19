/**
 * Code Action Provider
 *
 * Provides quick fixes and refactorings (lightbulb menu).
 */

import type { Monaco } from "@monaco-editor/react";
import type {
  editor,
  CancellationToken,
  IDisposable,
  languages,
  IRange,
} from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";

/**
 * Register code action provider for a language.
 */
export function registerCodeActionProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerCodeActionProvider(languageId, {
    async provideCodeActions(
      model: editor.ITextModel,
      range: IRange,
      context: languages.CodeActionContext,
      _token: CancellationToken
    ) {
      try {
        // Convert Monaco diagnostics to LSP format for context
        const diagnostics = context.markers.map((m: editor.IMarkerData) => ({
          range: {
            start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
            end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
          },
          message: m.message,
          severity: m.severity,
          code: m.code,
          source: m.source,
        }));

        const actions = await lspApi.lspCodeAction(
          model.uri.path,
          range.startLineNumber - 1,
          range.startColumn - 1,
          range.endLineNumber - 1,
          range.endColumn - 1,
          diagnostics
        );

        const codeActions: languages.CodeAction[] = actions.map((action) => {
          const result: languages.CodeAction = {
            title: action.title,
            kind: action.kind,
            isPreferred: action.isPreferred,
          };

          if (action.edit) {
            result.edit = { edits: [] };
            if (action.edit.changes) {
              for (const [uri, textEdits] of Object.entries(action.edit.changes)) {
                for (const textEdit of textEdits) {
                  result.edit.edits.push({
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
          }

          return result;
        });

        return {
          actions: codeActions,
          dispose: () => {},
        };
      } catch (e) {
        console.error("[LSP] codeAction error:", e);
        return { actions: [], dispose: () => {} };
      }
    },
  });
}
