/**
 * Shiki theme integration for Monaco
 *
 * Initializes Shiki highlighter and connects it to Monaco for
 * TextMate-based syntax highlighting with Vitesse themes.
 */

import type { Monaco } from "@monaco-editor/react";
import { bundledLanguages, createHighlighter, type Highlighter } from "shiki";
import { shikiToMonaco } from "@shikijs/monaco";

let shikiInitialized = false;
let shikiInitializationPromise: Promise<Highlighter> | null = null;
let highlighterInstance: Highlighter | null = null;

/**
 * Initialize Shiki highlighter and connect it to Monaco.
 * This replaces Monaco's built-in syntax highlighting with Shiki's TextMate-based tokenization.
 *
 * @param monaco - Monaco instance
 * @returns Promise that resolves when Shiki is initialized
 */
export async function initializeShiki(monaco: Monaco): Promise<void> {
  if (shikiInitialized) return;

  // If initialization is already in progress, wait for it
  if (shikiInitializationPromise) {
    await shikiInitializationPromise;
    return;
  }

  // Start initialization
  shikiInitializationPromise = (async () => {
    console.log("[Monaco] Initializing Shiki highlighter...");

    // Use all languages from Shiki's bundledLanguages as the source of truth
    const shikiLanguageIds = Object.keys(bundledLanguages);

    console.log(
      `[Monaco] Loading ${shikiLanguageIds.length} languages for Shiki:`,
      shikiLanguageIds.slice(0, 10).join(", "),
      "..."
    );

    // Initialize Shiki highlighter with all languages and Vitesse themes
    const highlighter = await createHighlighter({
      themes: ["vitesse-dark", "vitesse-light"],
      langs: shikiLanguageIds as Parameters<typeof createHighlighter>[0]["langs"],
    });

    console.log("[Monaco] Shiki highlighter initialized");

    // Register all languages in Monaco
    const registeredLanguages = new Set<string>();

    // Register all Shiki language IDs from bundledLanguages
    for (const shikiLang of shikiLanguageIds) {
      if (!registeredLanguages.has(shikiLang)) {
        const languages = monaco.languages.getLanguages();
        if (!languages.find((l: { id: string }) => l.id === shikiLang)) {
          monaco.languages.register({ id: shikiLang });
          registeredLanguages.add(shikiLang);
        }
      }
    }

    // Also register Monaco language IDs that differ from Shiki IDs
    // This ensures compatibility when the backend sends Monaco IDs (e.g., typescriptreact)
    const monacoLanguageIds = ["typescriptreact", "javascriptreact"];

    for (const monacoLang of monacoLanguageIds) {
      if (!registeredLanguages.has(monacoLang)) {
        const languages = monaco.languages.getLanguages();
        if (!languages.find((l: { id: string }) => l.id === monacoLang)) {
          monaco.languages.register({ id: monacoLang });
          registeredLanguages.add(monacoLang);
        }
      }
    }

    console.log(
      `[Monaco] Registered ${registeredLanguages.size} languages in Monaco`
    );

    // Connect Shiki to Monaco
    // This transfers Shiki's grammars and themes to Monaco
    shikiToMonaco(highlighter, monaco);

    console.log("[Monaco] Connected Shiki tokenization to Monaco");

    shikiInitialized = true;
    highlighterInstance = highlighter;
    console.log("[Monaco] Shiki initialization complete");

    return highlighter;
  })();

  await shikiInitializationPromise;
}

/**
 * Check if Shiki has been initialized.
 */
export function isShikiInitialized(): boolean {
  return shikiInitialized;
}

/**
 * Get the Shiki highlighter instance (if initialized).
 */
export function getHighlighter(): Highlighter | null {
  return highlighterInstance;
}

/**
 * Get the appropriate Monaco theme name based on the current theme mode.
 *
 * @param isDark - Whether dark mode is active
 * @returns Theme name to use in Monaco
 */
export function getMonacoTheme(isDark: boolean): string {
  if (shikiInitialized) {
    return isDark ? "vitesse-dark" : "vitesse-light";
  }
  // Fall back to default Monaco themes if Shiki not initialized
  return isDark ? "vs-dark" : "vs";
}
