/**
 * Signature Help Provider
 *
 * Shows function parameter hints when typing.
 * Triggered by `(` and `,` characters.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position, CancellationToken, IDisposable, languages, IMarkdownString } from "monaco-editor";
import * as lspApi from "../../lib/tauri-ide";
import type { LspSignatureHelp, LspMarkupContent } from "../../types/lsp";

/**
 * Convert LSP documentation to Monaco MarkdownString.
 */
function convertDocumentation(
  doc: LspMarkupContent | string | undefined
): IMarkdownString | string | undefined {
  if (!doc) return undefined;
  if (typeof doc === "string") return doc;
  if (doc.kind === "markdown") {
    return { value: doc.value };
  }
  return doc.value;
}

/**
 * Convert LSP SignatureHelp to Monaco SignatureHelpResult.
 */
function convertSignatureHelp(
  lspHelp: LspSignatureHelp
): languages.SignatureHelpResult {
  return {
    value: {
      signatures: lspHelp.signatures.map((sig) => ({
        label: sig.label,
        documentation: convertDocumentation(sig.documentation),
        parameters: sig.parameters?.map((param) => ({
          label: param.label,
          documentation: convertDocumentation(param.documentation),
        })) ?? [],
        activeParameter: sig.activeParameter,
      })),
      activeSignature: lspHelp.activeSignature ?? 0,
      activeParameter: lspHelp.activeParameter ?? 0,
    },
    dispose: () => {},
  };
}

/**
 * Register signature help provider for a language.
 */
export function registerSignatureHelpProvider(
  monaco: Monaco,
  languageId: string
): IDisposable {
  return monaco.languages.registerSignatureHelpProvider(languageId, {
    signatureHelpTriggerCharacters: ["(", ","],
    signatureHelpRetriggerCharacters: [","],

    async provideSignatureHelp(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken,
      context: languages.SignatureHelpContext
    ): Promise<languages.SignatureHelpResult | null | undefined> {
      try {
        const triggerChar =
          context.triggerKind === monaco.languages.SignatureHelpTriggerKind.TriggerCharacter
            ? context.triggerCharacter
            : undefined;

        const result = await lspApi.lspSignatureHelp(
          model.uri.path,
          position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
          position.column - 1,
          triggerChar
        );

        if (!result || result.signatures.length === 0) {
          return null;
        }

        return convertSignatureHelp(result);
      } catch (e) {
        console.error("[LSP] signature_help error:", e);
        return null;
      }
    },
  });
}
