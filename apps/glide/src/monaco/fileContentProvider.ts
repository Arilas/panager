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

// Track in-flight model creation promises to prevent duplicate concurrent creations
const pendingModelCreations = new Map<string, Promise<void>>();

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

  // Load all files in parallel, with deduplication for concurrent requests
  await Promise.all(
    urisNeedingModels.map((uri) => {
      const uriString = uri.toString();

      // If there's already a pending creation for this URI, wait for it
      const existingPromise = pendingModelCreations.get(uriString);
      if (existingPromise) {
        return existingPromise;
      }

      // Create the model loading promise
      const creationPromise = (async () => {
        try {
          // Check if model was created while we were waiting
          if (monaco.editor.getModel(uri)) return;

          const filePath = uri.path;
          const [fileContent, language] = await Promise.all([
            readFile(filePath),
            getFileLanguage(filePath),
          ]);

          // Final check after async operations
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
        } finally {
          // Clean up the pending map
          pendingModelCreations.delete(uriString);
        }
      })();

      // Track the pending creation
      pendingModelCreations.set(uriString, creationPromise);
      return creationPromise;
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
