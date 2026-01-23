/**
 * Editor Opener Registration
 *
 * Intercepts Monaco's file opening requests (e.g., from go-to-definition)
 * and routes them through the files store for proper history tracking.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, IDisposable, IPosition, IRange } from "monaco-editor";
import { useTabsStore } from "../stores/tabs";
import { useMonacoStore } from "../stores/monaco";
import { buildFileUrl } from "../lib/tabs/url";

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
      selectionOrPosition?: IRange | IPosition
    ): boolean {
      // Only handle file:// URIs
      if (resource.scheme !== "file") {
        return false; // Let Monaco handle other schemes
      }

      const filePath = resource.path;
      const position = selectionOrPosition
        ? {
            line: (selectionOrPosition as IRange).startLineNumber ?? (selectionOrPosition as IPosition).lineNumber,
            column: (selectionOrPosition as IRange).startColumn ?? (selectionOrPosition as IPosition).column,
          }
        : { line: 1, column: 1 };

      console.log("[EditorOpener] Opening file:", filePath, "at position:", position);

      const url = buildFileUrl(filePath);
      const tabsStore = useTabsStore.getState();
      const monacoStore = useMonacoStore.getState();

      // Check if this file is already the active tab in the current group
      const activeGroupId = tabsStore.activeGroupId;
      if (activeGroupId) {
        const group = tabsStore.groups.find((g) => g.id === activeGroupId);
        if (group?.activeUrl === url) {
          // Same file is already active - just scroll to position
          console.log("[EditorOpener] Same file active, scrolling to position:", position);
          const activeEditor = monacoStore.activeEditor;
          if (activeEditor) {
            activeEditor.setPosition({
              lineNumber: position.line,
              column: position.column,
            });
            activeEditor.revealLineInCenter(position.line);
            activeEditor.focus();
          }
          // Still update the store for persistence
          tabsStore.updateCursorPosition(url, position);
          return true;
        }
      }

      // Open the file through the tabs store with cursor position
      tabsStore.openTab({
        url,
        isPreview: false,
        cursorPosition: position,
      });
      return true; // We handled it
    },
  });

  openerRegistered = true;
  console.log("[Monaco] Registered editor opener for file navigation");
  return openerDisposable;
}

/**
 * Check if the editor opener has been registered.
 */
export function isEditorOpenerRegistered(): boolean {
  return openerRegistered;
}
