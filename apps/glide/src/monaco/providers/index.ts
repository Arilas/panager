/**
 * LSP Provider Registration
 *
 * Registers all language providers for Monaco that connect to the backend LSP.
 */

import type { Monaco } from "@monaco-editor/react";
import type { IDisposable } from "monaco-editor";
import { registerDefinitionProvider } from "./definition";
import { registerHoverProvider } from "./hover";
import { registerCompletionProvider } from "./completion";
import { registerReferencesProvider } from "./references";
import { registerRenameProvider } from "./rename";
import { registerCodeActionProvider } from "./codeAction";
import { registerCodeLensProvider } from "./codeLens";
import { registerInlayHintsProvider } from "./inlayHints";
import { registerDocumentHighlightProvider } from "./documentHighlight";
import { registerSignatureHelpProvider } from "./signatureHelp";
import {
  registerDocumentFormattingProvider,
  registerDocumentRangeFormattingProvider,
  registerOnTypeFormattingProvider,
} from "./formatting";
import { registerTypeDefinitionProvider } from "./typeDefinition";
import { registerImplementationProvider } from "./implementation";
import { registerFoldingRangeProvider } from "./foldingRange";
import { registerSelectionRangeProvider } from "./selectionRange";
import { registerLinkedEditingRangeProvider } from "./linkedEditingRanges";

// Languages that use the backend LSP
// Include both Monaco IDs (typescriptreact/javascriptreact) and Shiki IDs (tsx/jsx)
// for compatibility. The editor uses Shiki IDs for tokenization, but LSP providers
// are registered for both to ensure they work regardless of which ID is used.
export const LSP_LANGUAGES = [
  // TypeScript/JavaScript
  "typescript",
  "typescriptreact", // Monaco ID
  "tsx", // Shiki ID
  "javascript",
  "javascriptreact", // Monaco ID
  "jsx", // Shiki ID

  // JSON
  "json",
  "jsonc",

  // CSS (also used by Tailwind CSS)
  "css",
  "scss",
  "less",

  // HTML (also used by Emmet, Tailwind CSS)
  "html",

  // YAML
  "yaml",

  // Web frameworks (Vue, Svelte, Astro LSP support)
  "vue",
  "svelte",
  "astro",

  // Angular uses TypeScript and HTML (already registered above)

  // Markdown (Prettier, ESLint support)
  "markdown",

  // GraphQL (Prettier support)
  "graphql",

  // Rust (rust-analyzer support)
  "rust",

  // TOML (tombi support)
  "toml",

  // SQL (sql-language-server support)
  "sql",

  // Dockerfile (dockerfile-language-server support)
  "dockerfile",

  // Prisma (prisma-language-server support)
  "prisma",
];

let providersRegistered = false;
const disposables: IDisposable[] = [];

/**
 * Register all LSP providers for Monaco.
 * Should be called once during Monaco initialization.
 *
 * @param monaco - Monaco instance
 */
export function registerAllProviders(monaco: Monaco): void {
  if (providersRegistered) return;

  console.log("[Monaco] Registering LSP providers for:", LSP_LANGUAGES.join(", "));

  for (const languageId of LSP_LANGUAGES) {
    // Definition provider (Cmd+Click, F12)
    disposables.push(registerDefinitionProvider(monaco, languageId));

    // Hover provider (mouse over symbol)
    disposables.push(registerHoverProvider(monaco, languageId));

    // Completion provider (IntelliSense)
    disposables.push(registerCompletionProvider(monaco, languageId));

    // References provider (Shift+F12)
    disposables.push(registerReferencesProvider(monaco, languageId));

    // Rename provider (F2)
    disposables.push(registerRenameProvider(monaco, languageId));

    // Code action provider (lightbulb/quick fixes)
    disposables.push(registerCodeActionProvider(monaco, languageId));

    // Inlay hints provider (inline type/parameter hints)
    disposables.push(registerInlayHintsProvider(monaco, languageId));

    // Document highlight provider (highlight occurrences of symbol under cursor)
    disposables.push(registerDocumentHighlightProvider(monaco, languageId));

    // Signature help provider (function parameter hints)
    disposables.push(registerSignatureHelpProvider(monaco, languageId));

    // Formatting providers
    disposables.push(registerDocumentFormattingProvider(monaco, languageId));
    disposables.push(registerDocumentRangeFormattingProvider(monaco, languageId));
    disposables.push(registerOnTypeFormattingProvider(monaco, languageId));

    // Type definition provider (Ctrl+Shift+F12)
    disposables.push(registerTypeDefinitionProvider(monaco, languageId));

    // Implementation provider (go to implementations)
    disposables.push(registerImplementationProvider(monaco, languageId));

    // Folding range provider (custom code folding)
    disposables.push(registerFoldingRangeProvider(monaco, languageId));

    // Selection range provider (smart selection expand/shrink)
    disposables.push(registerSelectionRangeProvider(monaco, languageId));

    // Linked editing range provider (edit paired tags simultaneously)
    disposables.push(registerLinkedEditingRangeProvider(monaco, languageId));
  }

  // CodeLens provider (blame above functions) - registered once for all languages
  disposables.push(registerCodeLensProvider(monaco));

  providersRegistered = true;
  console.log("[Monaco] LSP providers registered");
}

/**
 * Dispose all registered providers.
 * Generally not needed as providers persist for the app lifetime.
 */
export function disposeAllProviders(): void {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
  providersRegistered = false;
}

/**
 * Check if providers have been registered.
 */
export function areProvidersRegistered(): boolean {
  return providersRegistered;
}
