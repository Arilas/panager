/**
 * Hook for Git Blame decorations in Monaco editor
 *
 * Provides inline blame information at the end of the current line (VS Code style)
 * Uses a content widget overlay since Monaco's after.content doesn't work reliably
 * with @monaco-editor/react CDN setup.
 *
 * Features:
 * - Shows blame for unchanged lines (mapped through virtual diff)
 * - Shows "You • Uncommitted" for new/modified lines
 * - Updates in real-time as you edit
 */

import { useEffect, useRef, useCallback } from "react";
import type { editor } from "monaco-editor";
import { useIdeStore } from "../stores/ide";
import { useGitStore } from "../stores/git";
import { useFilesStore } from "../stores/files";
import { useLineDiff } from "./useLineDiff";

interface UseGitBlameOptions {
  editor: editor.IStandaloneCodeEditor | null;
  filePath: string;
  enabled?: boolean;
}

// Cache for debouncing blame line updates
const DEBOUNCE_MS = 100;

/**
 * Format a timestamp as relative time (e.g., "3 days ago")
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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Create a blame content widget that displays at the end of a line.
 * The widget is positioned after all line content using a large column number.
 */
function createBlameWidget(
  lineNumber: number,
  text: string,
  isUncommitted: boolean
): editor.IContentWidget {
  const domNode = document.createElement("span");
  domNode.className = "git-blame-widget";
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
 * Hook that adds inline git blame decorations to Monaco editor
 */
export function useGitBlame({ editor, filePath, enabled = true }: UseGitBlameOptions) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const { loadBlame, blameCache, blameLoading, refreshBlameForFile } = useGitStore();

  // Track file dirty state for refresh on save
  const openFile = useFilesStore((s) => s.openFiles.find((f) => f.path === filePath));
  const isDirty = openFile?.isDirty ?? false;

  const widgetRef = useRef<editor.IContentWidget | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastLineRef = useRef<number | null>(null);
  const wasDirtyRef = useRef<boolean>(false);

  // Get blame data for current file
  const blameData = blameCache[filePath];
  const isLoading = blameLoading[filePath] ?? false;

  // Use shared line diff hook
  const { lineDiff } = useLineDiff({ filePath });

  // Load blame data when file opens
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Check if already cached or loading (will also fetch HEAD content for diff)
    if (!blameCache[filePath] && !blameLoading[filePath]) {
      console.log("[GitBlame] Loading blame for:", filePath);
      loadBlame(projectContext.projectPath, filePath);
    }
  }, [enabled, projectContext, filePath, blameCache, blameLoading, loadBlame]);

  // Refresh blame when file is saved (dirty goes from true to false)
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Detect save: was dirty, now clean
    if (wasDirtyRef.current && !isDirty) {
      console.log("[GitBlame] File saved, refreshing blame for:", filePath);
      refreshBlameForFile(projectContext.projectPath, filePath);
    }

    // Update the ref for next comparison
    wasDirtyRef.current = isDirty;
  }, [enabled, projectContext, filePath, isDirty, refreshBlameForFile]);

  // Remove existing widget
  const removeWidget = useCallback(() => {
    if (editor && widgetRef.current) {
      editor.removeContentWidget(widgetRef.current);
      widgetRef.current = null;
    }
  }, [editor]);

  // Update blame widget when cursor moves
  const updateBlameWidget = useCallback(
    (lineNumber: number) => {
      if (!editor || !enabled) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      // Remove existing widget
      removeWidget();

      // Need blame data to show anything
      if (!blameData) {
        return;
      }

      // Use virtual diff to map current line to original line
      let blameText: string;
      let isUncommitted = false;

      if (lineDiff) {
        const mapping = lineDiff.mappings[lineNumber - 1];

        if (!mapping || mapping.status === "added" || mapping.status === "modified") {
          // New or modified line - show uncommitted indicator
          blameText = "You • Uncommitted";
          isUncommitted = true;
        } else if (mapping.originalLine !== null) {
          // Unchanged line - map to original line and get blame
          const blameLine = blameData.lines.find((l) => l.lineNumber === mapping.originalLine);
          if (blameLine) {
            blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)} • ${blameLine.summary.substring(0, 50)}${blameLine.summary.length > 50 ? "..." : ""}`;
          } else {
            // No blame for this original line (shouldn't happen normally)
            return;
          }
        } else {
          return;
        }
      } else {
        // No diff computed yet, use direct line lookup
        const blameLine = blameData.lines.find((l) => l.lineNumber === lineNumber);
        if (!blameLine) {
          return;
        }
        blameText = `${blameLine.author}, ${formatRelativeTime(blameLine.timestamp)} • ${blameLine.summary.substring(0, 50)}${blameLine.summary.length > 50 ? "..." : ""}`;
      }

      // Create and add the widget (positioned at end of line via large column)
      widgetRef.current = createBlameWidget(lineNumber, blameText, isUncommitted);
      editor.addContentWidget(widgetRef.current);
    },
    [editor, enabled, blameData, lineDiff, removeWidget]
  );

  // Listen for cursor position changes
  useEffect(() => {
    if (!editor || !enabled) return;

    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      const lineNumber = e.position.lineNumber;

      // Skip if same line (but update if lineDiff changed)
      if (lineNumber === lastLineRef.current) return;
      lastLineRef.current = lineNumber;

      // Debounce the update
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        updateBlameWidget(lineNumber);
      }, DEBOUNCE_MS);
    });

    // Initial widget for current line
    const pos = editor.getPosition();
    if (pos) {
      updateBlameWidget(pos.lineNumber);
    }

    return () => {
      cursorDisposable.dispose();
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      removeWidget();
    };
  }, [editor, enabled, updateBlameWidget, removeWidget]);

  // Update widget when blame data or line diff changes
  useEffect(() => {
    if (!editor || !enabled || !blameData) return;

    const pos = editor.getPosition();
    if (pos) {
      // Force update even if on same line (because lineDiff might have changed)
      lastLineRef.current = null;
      updateBlameWidget(pos.lineNumber);
    }
  }, [editor, enabled, blameData, lineDiff, updateBlameWidget]);

  return {
    isLoading,
    hasBlame: !!blameData,
    lineDiff,
  };
}
