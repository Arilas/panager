/**
 * Completion Provider
 *
 * Provides IntelliSense/autocomplete suggestions.
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
 * Map LSP completion kind to Monaco completion kind.
 */
function mapCompletionKind(
  monaco: Monaco,
  kind?: number
): languages.CompletionItemKind {
  if (!kind) return monaco.languages.CompletionItemKind.Text;

  // LSP CompletionItemKind values
  const kindMap: Record<number, languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };

  return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
}

/**
 * Register completion provider for a language.
 */
export function registerCompletionProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: [".", '"', "'", "/", "@", "<"],

    async provideCompletionItems(
      model: editor.ITextModel,
      position: Position,
      context: languages.CompletionContext,
      _token: CancellationToken
    ) {
      try {
        const triggerChar =
          context.triggerKind === 1 // TriggerCharacter
            ? context.triggerCharacter
            : undefined;

        const result = await lspApi.lspCompletion(
          model.uri.path,
          position.lineNumber - 1,
          position.column - 1,
          triggerChar
        );

        const suggestions: languages.CompletionItem[] = result.items.map(
          (item) => ({
            label: item.label,
            kind: mapCompletionKind(monaco, item.kind),
            detail: item.detail,
            documentation: item.documentation
              ? { value: item.documentation.value, isTrusted: true }
              : undefined,
            insertText: item.insertText || item.label,
            insertTextRules:
              item.insertTextFormat === 2
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
            sortText: item.sortText,
            filterText: item.filterText,
            range: undefined as unknown as languages.CompletionItem["range"], // Use default range
          })
        );

        return {
          suggestions,
          incomplete: result.isIncomplete,
        };
      } catch (e) {
        console.error("[LSP] completion error:", e);
        return { suggestions: [] };
      }
    },
  });
}
