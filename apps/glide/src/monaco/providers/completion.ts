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
  IRange,
} from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import { notifyFileChanged } from "../../lib/tauri-ide";
import type { LspCompletionItem } from "../../types/lsp";

/**
 * Map LSP CompletionItemKind to Monaco CompletionItemKind.
 *
 * LSP and Monaco use different numeric values for completion kinds:
 * - LSP: Text=1, Method=2, Function=3, etc.
 * - Monaco: Method=0, Function=1, Constructor=2, etc.
 *
 * This function converts from LSP values to Monaco values.
 */
function mapCompletionKind(
  monaco: Monaco,
  lspKind?: number
): languages.CompletionItemKind {
  if (lspKind === undefined || lspKind === null) {
    return monaco.languages.CompletionItemKind.Text;
  }

  // Map from LSP CompletionItemKind to Monaco CompletionItemKind
  // LSP spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#completionItemKind
  switch (lspKind) {
    case 1:
      return monaco.languages.CompletionItemKind.Text;
    case 2:
      return monaco.languages.CompletionItemKind.Method;
    case 3:
      return monaco.languages.CompletionItemKind.Function;
    case 4:
      return monaco.languages.CompletionItemKind.Constructor;
    case 5:
      return monaco.languages.CompletionItemKind.Field;
    case 6:
      return monaco.languages.CompletionItemKind.Variable;
    case 7:
      return monaco.languages.CompletionItemKind.Class;
    case 8:
      return monaco.languages.CompletionItemKind.Interface;
    case 9:
      return monaco.languages.CompletionItemKind.Module;
    case 10:
      return monaco.languages.CompletionItemKind.Property;
    case 11:
      return monaco.languages.CompletionItemKind.Unit;
    case 12:
      return monaco.languages.CompletionItemKind.Value;
    case 13:
      return monaco.languages.CompletionItemKind.Enum;
    case 14:
      return monaco.languages.CompletionItemKind.Keyword;
    case 15:
      return monaco.languages.CompletionItemKind.Snippet;
    case 16:
      return monaco.languages.CompletionItemKind.Color;
    case 17:
      return monaco.languages.CompletionItemKind.File;
    case 18:
      return monaco.languages.CompletionItemKind.Reference;
    case 19:
      return monaco.languages.CompletionItemKind.Folder;
    case 20:
      return monaco.languages.CompletionItemKind.EnumMember;
    case 21:
      return monaco.languages.CompletionItemKind.Constant;
    case 22:
      return monaco.languages.CompletionItemKind.Struct;
    case 23:
      return monaco.languages.CompletionItemKind.Event;
    case 24:
      return monaco.languages.CompletionItemKind.Operator;
    case 25:
      return monaco.languages.CompletionItemKind.TypeParameter;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

/**
 * Convert LSP completion item to Monaco completion item.
 */
function convertCompletionItem(
  monaco: Monaco,
  item: LspCompletionItem,
  defaultRange: IRange
): languages.CompletionItem {
  // Use textEdit range if available, otherwise use default range
  let range: IRange | languages.CompletionItemRanges = defaultRange;

  if (item.textEdit) {
    range = {
      startLineNumber: item.textEdit.range.start.line + 1,
      startColumn: item.textEdit.range.start.character + 1,
      endLineNumber: item.textEdit.range.end.line + 1,
      endColumn: item.textEdit.range.end.character + 1,
    };
  }

  // Determine insert text: prefer textEdit.newText, then insertText, then label
  const insertText = item.textEdit?.newText ?? item.insertText ?? item.label;

  return {
    label: item.label,
    kind: mapCompletionKind(monaco, item.kind),
    detail: item.detail,
    documentation: item.documentation
      ? { value: item.documentation.value, isTrusted: true }
      : undefined,
    insertText,
    insertTextRules:
      item.insertTextFormat === 2
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
    sortText: item.sortText,
    filterText: item.filterText,
    range,
  };
}

/**
 * Register completion provider for a language.
 */
export function registerCompletionProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerCompletionItemProvider(languageId, {
    // Trigger characters for various LSP features:
    // - "." for property access (TypeScript, JavaScript)
    // - '"', "'" for imports, attributes (all languages)
    // - "/" for path completions (imports)
    // - "@" for decorators, directives (TypeScript, Tailwind)
    // - "<" for JSX tags, HTML elements
    // - ":" for Tailwind variants (hover:, focus:, etc.)
    // - "-" for Tailwind utilities (bg-, text-, etc.)
    // - " " for Tailwind class completions after space
    // - "`" for template literals
    triggerCharacters: [".", '"', "'", "/", "@", "<", ":", "-", " ", "`"],

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

        // Sync document content before requesting completions.
        // This ensures the LSP has the latest content, bypassing the debounce
        // in the editor store that could cause stale completions.
        const filePath = model.uri.path;
        const content = model.getValue();
        await notifyFileChanged(filePath, content);

        const result = await lspApi.lspCompletion(
          filePath,
          position.lineNumber - 1,
          position.column - 1,
          triggerChar
        );

        // Calculate default range (word at cursor position)
        const word = model.getWordUntilPosition(position);
        const defaultRange: IRange = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const suggestions = result.items.map((item) =>
          convertCompletionItem(monaco, item, defaultRange)
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
