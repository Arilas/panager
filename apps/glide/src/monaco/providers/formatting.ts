/**
 * Formatting Providers
 *
 * Provides document formatting, range formatting, and on-type formatting.
 * - Document formatting: Format entire document (Shift+Alt+F)
 * - Range formatting: Format selected code (Cmd+K Cmd+F)
 * - On-type formatting: Auto-format as you type (semicolons, braces)
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, Range, CancellationToken, IDisposable } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import type { LspTextEdit, LspFormattingOptions } from "../../types/lsp";

/**
 * Convert LSP text edits to Monaco text edits.
 */
function convertTextEdits(
  edits: LspTextEdit[]
): import("monaco-editor").languages.TextEdit[] {
  return edits.map((edit) => ({
    range: {
      startLineNumber: edit.range.start.line + 1,
      startColumn: edit.range.start.character + 1,
      endLineNumber: edit.range.end.line + 1,
      endColumn: edit.range.end.character + 1,
    },
    text: edit.newText,
  }));
}

/**
 * Register document formatting provider for a language.
 * Triggered by Shift+Alt+F (format document).
 */
export function registerDocumentFormattingProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerDocumentFormattingEditProvider(languageId, {
    async provideDocumentFormattingEdits(
      model: editor.ITextModel,
      options: import("monaco-editor").languages.FormattingOptions,
      _token: CancellationToken
    ) {
      try {
        const lspOptions: LspFormattingOptions = {
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
        };

        const edits = await lspApi.lspFormatDocument(model.uri.path, lspOptions);
        return convertTextEdits(edits);
      } catch (e) {
        console.error("[LSP] format_document error:", e);
        return [];
      }
    },
  });
}

/**
 * Register document range formatting provider for a language.
 * Triggered by Cmd+K Cmd+F (format selection).
 */
export function registerDocumentRangeFormattingProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
    async provideDocumentRangeFormattingEdits(
      model: editor.ITextModel,
      range: Range,
      options: import("monaco-editor").languages.FormattingOptions,
      _token: CancellationToken
    ) {
      try {
        const lspOptions: LspFormattingOptions = {
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
        };

        const edits = await lspApi.lspFormatRange(
          model.uri.path,
          range.startLineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          range.startColumn - 1,
          range.endLineNumber - 1,
          range.endColumn - 1,
          lspOptions
        );
        return convertTextEdits(edits);
      } catch (e) {
        console.error("[LSP] format_range error:", e);
        return [];
      }
    },
  });
}

/**
 * Register on-type formatting provider for a language.
 * Auto-formats code when typing specific characters like `;`, `}`, `\n`.
 */
export function registerOnTypeFormattingProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerOnTypeFormattingEditProvider(languageId, {
    autoFormatTriggerCharacters: [";", "}", "\n"],

    async provideOnTypeFormattingEdits(
      model: editor.ITextModel,
      position: Position,
      ch: string,
      options: import("monaco-editor").languages.FormattingOptions,
      _token: CancellationToken
    ) {
      try {
        const lspOptions: LspFormattingOptions = {
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
        };

        const edits = await lspApi.lspFormatOnType(
          model.uri.path,
          position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          position.column - 1,
          ch,
          lspOptions
        );
        return convertTextEdits(edits);
      } catch (e) {
        console.error("[LSP] format_on_type error:", e);
        return [];
      }
    },
  });
}
