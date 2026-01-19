/**
 * Editor Opener Registration
 *
 * Intercepts Monaco's file opening requests (e.g., from go-to-definition)
 * and routes them through the editor store.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, IDisposable } from "monaco-editor";
import { useEditorStore } from "../stores/editor";
import { readFile } from "../lib/tauri-ide";

let openerRegistered = false;
let openerDisposable: IDisposable | null = null;

/**
 * Register an editor opener to intercept Monaco's file opening requests.
 * This is called when the user Cmd+Clicks on a symbol to go to its definition.
 */
export function registerEditorOpener(monaco: Monaco): IDisposable | null {
  if (openerRegistered) return openerDisposable;

  // Monaco's registerEditorOpener allows us to intercept when it tries to open a resource
  openerDisposable = monaco.editor.registerEditorOpener({
    openCodeEditor(
      _source: editor.ICodeEditor,
      resource: { scheme: string; path: string },
      selectionOrPosition?: { startLineNumber: number; startColumn: number }
    ): boolean {
      // Only handle file:// URIs
      if (resource.scheme !== "file") {
        return false; // Let Monaco handle other schemes
      }

      const filePath = resource.path;
      const position = selectionOrPosition
        ? {
            line: selectionOrPosition.startLineNumber,
            column: selectionOrPosition.startColumn,
          }
        : { line: 1, column: 1 };

      console.log("[EditorOpener] Opening file:", filePath, "at position:", position);

      // Open the file through the editor store
      openFileAtPosition(filePath, position);
      return true; // We handled it
    },
  });

  openerRegistered = true;
  console.log("[Monaco] Registered editor opener for file navigation");
  return openerDisposable;
}

/**
 * Open a file at a specific position.
 * This reads the file and opens it in the editor store.
 */
async function openFileAtPosition(
  filePath: string,
  position: { line: number; column: number }
): Promise<void> {
  try {
    const store = useEditorStore.getState();

    // Check if file is already open
    const existingState = store.getFileState(filePath);
    if (existingState) {
      // File already open, just activate and navigate
      store.setActiveTab(filePath);
      store.saveCursorPosition(filePath, position);

      // Navigate the editor if available
      const editor = store.activeEditor;
      if (editor) {
        editor.setPosition({
          lineNumber: position.line,
          column: position.column,
        });
        editor.revealLineInCenter(position.line);
        editor.focus();
      }
      return;
    }

    // Read the file
    const fileContent = await readFile(filePath);

    if (fileContent.isBinary) {
      console.warn("[EditorOpener] Cannot open binary file:", filePath);
      return;
    }

    // Open the file (not as preview since we're navigating to a specific position)
    store.openTab(filePath, fileContent.content, fileContent.language, false);

    // Save the position for restoration when editor mounts
    store.saveCursorPosition(filePath, position);

    // The editor will navigate to the position when it mounts
    // (handled in useEditor hook)
  } catch (error) {
    console.error("[EditorOpener] Failed to open file:", error);
  }
}

/**
 * Check if the editor opener has been registered.
 */
export function isEditorOpenerRegistered(): boolean {
  return openerRegistered;
}
