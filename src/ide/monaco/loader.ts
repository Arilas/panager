/**
 * Monaco Editor Loader
 *
 * Initializes Monaco with all configurations BEFORE any editor mounts.
 * This eliminates blinking by configuring everything upfront.
 *
 * Call initializeMonaco() at app startup.
 */

import { loader } from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";
import { useEditorStore } from "../stores/editor";
import { configureTypeScript } from "./typescript";
import { initializeShiki } from "./themes";
import { registerAllProviders } from "./providers";
import { injectEditorStyles } from "./decorations";
import { registerEditorOpener } from "./editorOpener";
import { setupStoreSubscriptions } from "./subscriptions";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

let monacoInstance: Monaco | null = null;
let initPromise: Promise<Monaco> | null = null;

/**
 * Initialize Monaco and configure everything BEFORE any editor mounts.
 * Call this at app startup.
 *
 * This function is idempotent - calling multiple times returns the same promise.
 */
export async function initializeMonaco(): Promise<Monaco> {
  if (monacoInstance) return monacoInstance;
  if (initPromise) return initPromise;

  initPromise = doInitialize();
  return initPromise;
}

async function doInitialize(): Promise<Monaco> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      useEditorStore.getState().setInitStatus("loading");

      console.log(`[Monaco] Initialization attempt ${attempt}/${MAX_RETRIES}`);

      // Configure CDN path
      loader.config({
        // paths: { vs: MONACO_CDN },
        monaco: monacoEditor,
      });

      // Load Monaco (this downloads from CDN)
      console.log("[Monaco] Loading from CDN...");
      const monaco = await loader.init();
      console.log("[Monaco] Loaded from CDN");

      // Configure TypeScript/JavaScript
      configureTypeScript(monaco);

      // Inject CSS styles for decorations
      injectEditorStyles();

      // Initialize Shiki for syntax highlighting (async, can be slow)
      console.log("[Monaco] Initializing Shiki...");
      await initializeShiki(monaco);

      // Register LSP providers
      registerAllProviders(monaco);

      // Register editor opener for file navigation
      registerEditorOpener(monaco);

      // Setup store subscriptions for provider/decoration updates
      setupStoreSubscriptions();

      // Store the instance
      monacoInstance = monaco;
      useEditorStore.getState().setMonacoInstance(monaco);
      useEditorStore.getState().setInitStatus("ready");

      console.log("[Monaco] Initialization complete");
      return monaco;
    } catch (error) {
      console.error(`[Monaco] Init attempt ${attempt} failed:`, error);

      if (attempt === MAX_RETRIES) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        useEditorStore.getState().setInitStatus("error", errorMessage);
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error("Monaco initialization failed after all retries");
}

/**
 * Get the Monaco instance (if initialized).
 */
export function getMonaco(): Monaco | null {
  return monacoInstance;
}

/**
 * Check if Monaco has been initialized.
 */
export function isMonacoReady(): boolean {
  return monacoInstance !== null;
}

/**
 * Get the current initialization status.
 */
export function getInitStatus() {
  return useEditorStore.getState().initState;
}
