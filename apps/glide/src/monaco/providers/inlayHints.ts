/**
 * Inlay Hints Provider
 *
 * Shows inline hints for type information and parameter names.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, CancellationToken, IDisposable } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import { InlayHintKind } from "../../types/lsp";
import { logLspErrorIfNeeded } from "./utils";

/**
 * Register inlay hints provider for a language.
 */
export function registerInlayHintsProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerInlayHintsProvider(languageId, {
    async provideInlayHints(
      model: editor.ITextModel,
      range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
      _token: CancellationToken
    ) {
      try {
        const hints = await lspApi.lspInlayHints(
          model.uri.path,
          range.startLineNumber - 1,
          range.startColumn - 1,
          range.endLineNumber - 1,
          range.endColumn - 1
        );

        if (!hints || hints.length === 0) {
          return { hints: [], dispose: () => {} };
        }

        return {
          hints: hints.map((hint) => ({
            position: {
              lineNumber: hint.position.line + 1,
              column: hint.position.character + 1,
            },
            label: hint.label,
            kind: hint.kind === InlayHintKind.Type
              ? monaco.languages.InlayHintKind.Type
              : hint.kind === InlayHintKind.Parameter
              ? monaco.languages.InlayHintKind.Parameter
              : undefined,
            paddingLeft: hint.paddingLeft,
            paddingRight: hint.paddingRight,
          })),
          dispose: () => {},
        };
      } catch (e) {
        logLspErrorIfNeeded("inlay hints", e);
        return { hints: [], dispose: () => {} };
      }
    },
  });
}
