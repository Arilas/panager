/**
 * Blame Widget Manager
 *
 * Manages inline git blame decorations at the end of the current line.
 * Uses content widgets positioned at a large column to appear after line content.
 */

import type { editor } from "monaco-editor";
import { useEditorStore } from "../../stores/editor";
import type { GitBlameLine } from "../../types";

// Debounce delay for updating blame widget on cursor move
const DEBOUNCE_MS = 100;

/**
 * Format a timestamp as relative time (e.g., "3d ago").
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Create a blame content widget that displays at the end of a line.
 */
function createBlameWidget(
  lineNumber: number,
  text: string,
  isUncommitted: boolean
): editor.IContentWidget {
  const domNode = document.createElement("span");
  domNode.className = `git-blame-widget ${isUncommitted ? "git-blame-widget--uncommitted" : "git-blame-widget--committed"}`;
  domNode.textContent = text;
  domNode.style.cssText = `
    color: ${isUncommitted ? "rgba(100, 180, 100, 0.7)" : "rgba(139, 148, 158, 0.7)"};
    font-style: italic;
    font-size: 0.9em;
    white-space: nowrap;
    pointer-events: none;
    margin-left: 3em;
  `;

  return {
    getId: () => "git-blame-widget",
    getDomNode: () => domNode,
    getPosition: () => ({
      // Position at a very large column to ensure it's after all content
      position: { lineNumber, column: 10000 },
      preference: [0], // EXACT position
    }),
  };
}

/**
 * Manages blame widget for an editor instance.
 * Not a React hook - this is a plain class that can be used anywhere.
 */
export class BlameWidgetManager {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private filePath: string | null = null;
  private widget: editor.IContentWidget | null = null;
  private debounceTimer: number | null = null;
  private lastLine: number | null = null;
  private cursorDisposable: { dispose: () => void } | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  /**
   * Attach the manager to an editor instance.
   */
  attach(editorInstance: editor.IStandaloneCodeEditor, filePath: string): void {
    this.detach(); // Clean up any previous attachment

    this.editor = editorInstance;
    this.filePath = filePath;

    // Listen for cursor position changes
    this.cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      const lineNumber = e.position.lineNumber;

      // Skip if same line
      if (lineNumber === this.lastLine) return;
      this.lastLine = lineNumber;

      // Debounce the update
      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(() => {
        this.updateWidget(lineNumber);
      }, DEBOUNCE_MS);
    });

    // Subscribe to store changes (blame data, lineDiff)
    // Track previous values for comparison
    let prevBlameData = useEditorStore.getState().getFileState(filePath)?.blameData;
    let prevLineDiff = useEditorStore.getState().getFileState(filePath)?.lineDiff;
    let prevEnabled = useEditorStore.getState().gitBlameEnabled;

    this.storeUnsubscribe = useEditorStore.subscribe((state) => {
      const fileState = state.getFileState(filePath);
      const blameData = fileState?.blameData;
      const lineDiff = fileState?.lineDiff;
      const enabled = state.gitBlameEnabled;

      // Check if relevant state changed
      if (
        blameData !== prevBlameData ||
        lineDiff !== prevLineDiff ||
        enabled !== prevEnabled
      ) {
        prevBlameData = blameData;
        prevLineDiff = lineDiff;
        prevEnabled = enabled;

        // When blame data or lineDiff changes, update the widget
        const pos = this.editor?.getPosition();
        if (pos) {
          this.lastLine = null; // Force update
          this.updateWidget(pos.lineNumber);
        }
      }
    });

    // Initial widget for current line
    const pos = editorInstance.getPosition();
    if (pos) {
      this.updateWidget(pos.lineNumber);
    }
  }

  /**
   * Detach the manager from the current editor.
   */
  detach(): void {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.removeWidget();

    if (this.cursorDisposable) {
      this.cursorDisposable.dispose();
      this.cursorDisposable = null;
    }

    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    this.editor = null;
    this.filePath = null;
    this.lastLine = null;
  }

  /**
   * Remove the existing widget from the editor.
   */
  private removeWidget(): void {
    if (this.editor && this.widget) {
      this.editor.removeContentWidget(this.widget);
      this.widget = null;
    }
  }

  /**
   * Update the blame widget for a specific line.
   */
  private updateWidget(lineNumber: number): void {
    if (!this.editor || !this.filePath) return;

    const state = useEditorStore.getState();

    // Check if blame is enabled
    if (!state.gitBlameEnabled) {
      this.removeWidget();
      return;
    }

    const fileState = state.getFileState(this.filePath);
    if (!fileState) {
      this.removeWidget();
      return;
    }

    // Remove existing widget
    this.removeWidget();

    // Need blame data to show anything
    const { blameData, lineDiff } = fileState;
    if (!blameData) return;

    // Use virtual diff to map current line to original line
    let blameText: string;
    let isUncommitted = false;

    if (lineDiff) {
      const mapping = lineDiff.mappings[lineNumber - 1];

      if (
        !mapping ||
        mapping.status === "added" ||
        mapping.status === "modified"
      ) {
        // New or modified line - show uncommitted indicator
        blameText = "You • Uncommitted";
        isUncommitted = true;
      } else if (mapping.originalLine !== null) {
        // Unchanged line - map to original line and get blame
        const blameLine = blameData.lines.find(
          (l: GitBlameLine) => l.lineNumber === mapping.originalLine
        );
        if (blameLine) {
          const summary =
            blameLine.summary.length > 50
              ? `${blameLine.summary.substring(0, 50)}...`
              : blameLine.summary;
          blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)} • ${summary}`;
        } else {
          // No blame for this original line
          return;
        }
      } else {
        return;
      }
    } else {
      // No diff computed yet, use direct line lookup
      const blameLine = blameData.lines.find(
        (l: GitBlameLine) => l.lineNumber === lineNumber
      );
      if (!blameLine) return;

      const summary =
        blameLine.summary.length > 50
          ? `${blameLine.summary.substring(0, 50)}...`
          : blameLine.summary;
      blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)} • ${summary}`;
    }

    // Create and add the widget
    this.widget = createBlameWidget(lineNumber, blameText, isUncommitted);
    this.editor.addContentWidget(this.widget);
  }
}

// Singleton instance for use across the app
export const blameWidgetManager = new BlameWidgetManager();
