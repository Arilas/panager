/**
 * Git Gutter Decoration Manager
 *
 * Shows colored indicators in the editor gutter for:
 * - Added lines (green bar)
 * - Modified lines (blue bar)
 */

import type { editor } from "monaco-editor";
import { useEditorStore } from "../../stores/editor";
import { GUTTER_ADDED_CLASS, GUTTER_MODIFIED_CLASS } from "./styles";

/**
 * Manages gutter decorations for an editor instance.
 * Not a React hook - this is a plain class that can be used anywhere.
 */
export class GutterDecorationManager {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private filePath: string | null = null;
  private decorations: string[] = [];
  private storeUnsubscribe: (() => void) | null = null;

  /**
   * Attach the manager to an editor instance.
   */
  attach(editorInstance: editor.IStandaloneCodeEditor, filePath: string): void {
    this.detach(); // Clean up any previous attachment

    this.editor = editorInstance;
    this.filePath = filePath;

    // Subscribe to store changes (lineDiff, gitGutterEnabled)
    // Track previous values for comparison
    let prevLineDiff = useEditorStore.getState().getFileState(filePath)?.lineDiff;
    let prevEnabled = useEditorStore.getState().gitGutterEnabled;

    this.storeUnsubscribe = useEditorStore.subscribe((state) => {
      const fileState = state.getFileState(filePath);
      const lineDiff = fileState?.lineDiff;
      const enabled = state.gitGutterEnabled;

      // Check if relevant state changed
      if (lineDiff !== prevLineDiff || enabled !== prevEnabled) {
        prevLineDiff = lineDiff;
        prevEnabled = enabled;
        this.updateDecorations();
      }
    });

    // Initial decorations
    this.updateDecorations();
  }

  /**
   * Detach the manager from the current editor.
   */
  detach(): void {
    this.clearDecorations();

    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    this.editor = null;
    this.filePath = null;
  }

  /**
   * Clear all gutter decorations.
   */
  private clearDecorations(): void {
    if (this.editor && this.decorations.length > 0) {
      try {
        this.decorations = this.editor.deltaDecorations(this.decorations, []);
      } catch {
        // Editor may be disposed
        this.decorations = [];
      }
    }
  }

  /**
   * Update gutter decorations based on current lineDiff.
   */
  private updateDecorations(): void {
    if (!this.editor || !this.filePath) return;

    const state = useEditorStore.getState();

    // Check if gutter is enabled
    if (!state.gitGutterEnabled) {
      this.clearDecorations();
      return;
    }

    const fileState = state.getFileState(this.filePath);
    const lineDiff = fileState?.lineDiff;

    // Clear existing decorations
    this.clearDecorations();

    // If no diff or no changes, nothing to show
    if (!lineDiff || !lineDiff.hasChanges) {
      return;
    }

    // Build decorations for added/modified lines
    const newDecorations: editor.IModelDeltaDecoration[] = [];

    for (const mapping of lineDiff.mappings) {
      if (mapping.status === "added") {
        newDecorations.push({
          range: {
            startLineNumber: mapping.currentLine,
            startColumn: 1,
            endLineNumber: mapping.currentLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            linesDecorationsClassName: GUTTER_ADDED_CLASS,
          },
        });
      } else if (mapping.status === "modified") {
        newDecorations.push({
          range: {
            startLineNumber: mapping.currentLine,
            startColumn: 1,
            endLineNumber: mapping.currentLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            linesDecorationsClassName: GUTTER_MODIFIED_CLASS,
          },
        });
      }
    }

    // Apply decorations
    if (newDecorations.length > 0) {
      this.decorations = this.editor.deltaDecorations([], newDecorations);
    }
  }

  /**
   * Force a refresh of decorations.
   */
  refresh(): void {
    this.updateDecorations();
  }
}

// Singleton instance for use across the app
export const gutterDecorationManager = new GutterDecorationManager();
