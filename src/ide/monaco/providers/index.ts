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

// Languages that use the backend LSP
// Include both Monaco IDs (typescriptreact/javascriptreact) and Shiki IDs (tsx/jsx)
// for compatibility. The editor uses Shiki IDs for tokenization, but LSP providers
// are registered for both to ensure they work regardless of which ID is used.
export const LSP_LANGUAGES = [
  "typescript",
  "typescriptreact", // Monaco ID
  "tsx", // Shiki ID
  "javascript",
  "javascriptreact", // Monaco ID
  "jsx", // Shiki ID
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
