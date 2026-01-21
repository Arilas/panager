/**
 * File Content Provider for Monaco
 *
 * Enables Monaco to load file content on-demand for features like:
 * - Peek widget (references, implementations)
 * - Go to definition preview
 * - Any widget that needs to display files not currently open
 *
 * Monaco's SimpleEditorModelResolverService only looks at existing models,
 * so we need to pre-create models for files before the peek widget tries
 * to display them.
 */

import type { Monaco } from "@monaco-editor/react";
import type { Uri } from "monaco-editor";
import { readFile, getFileLanguage } from "../lib/tauri-ide";

let monacoInstance: Monaco | null = null;

/**
 * Initialize the file content provider with the Monaco instance.
 * Call this during Monaco initialization.
 */
export function initFileContentProvider(monaco: Monaco): void {
  monacoInstance = monaco;
  console.log("[Monaco] File content provider initialized");
}

/**
 * Ensure models exist for the given URIs.
 * This must be called before Monaco's peek widget tries to display these files.
 *
 * @param uris Array of file URIs to ensure models for
 * @returns Promise that resolves when all models are created
 */
export async function ensureModelsForUris(uris: Uri[]): Promise<void> {
  if (!monacoInstance) {
    console.warn("[Monaco] File content provider not initialized");
    return;
  }

  const monaco = monacoInstance;

  // Filter to only URIs that don't already have models
  const urisNeedingModels = uris.filter(
    (uri) => uri.scheme === "file" && !monaco.editor.getModel(uri),
  );

  if (urisNeedingModels.length === 0) return;

  // Load all files in parallel
  await Promise.all(
    urisNeedingModels.map(async (uri) => {
      try {
        // Double-check model doesn't exist (race condition protection)
        if (monaco.editor.getModel(uri)) return;

        const filePath = uri.path;
        const [fileContent, language] = await Promise.all([
          readFile(filePath),
          getFileLanguage(filePath),
        ]);

        // Triple-check model doesn't exist after async operations
        if (monaco.editor.getModel(uri)) return;

        // Create the model
        monaco.editor.createModel(
          fileContent.content,
          language || "plaintext",
          uri,
        );

        console.log("[Monaco] Created model for:", filePath);
      } catch (error) {
        console.error("[Monaco] Failed to create model for:", uri.path, error);
      }
    }),
  );
}

/**
 * Ensure a model exists for a single file path.
 *
 * @param filePath The file path to ensure a model for
 * @returns Promise that resolves when the model is created
 */
export async function ensureModelForPath(filePath: string): Promise<void> {
  if (!monacoInstance) {
    console.warn("[Monaco] File content provider not initialized");
    return;
  }

  const uri = monacoInstance.Uri.file(filePath);
  await ensureModelsForUris([uri]);
}
