/**
 * Hook for Git Gutter decorations in Monaco editor
 *
 * Shows colored indicators in the editor gutter for:
 * - Added lines (green bar)
 * - Modified lines (blue bar)
 *
 * Similar to VS Code's git gutter feature.
 */

import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useLineDiff } from "./useLineDiff";
import { useGitStore } from "../stores/git";
import { useFilesStore } from "../stores/files";
import { useIdeStore } from "../stores/ide";

interface UseGitGutterOptions {
  editor: editor.IStandaloneCodeEditor | null;
  monaco: Monaco | null;
  filePath: string;
  enabled?: boolean;
}

// CSS class names for gutter decorations
const GUTTER_ADDED_CLASS = "git-gutter-added";
const GUTTER_MODIFIED_CLASS = "git-gutter-modified";

// Track if styles have been injected
let gutterStylesInjected = false;

/**
 * Inject CSS styles for git gutter decorations.
 * Monaco requires styles to be in the DOM.
 */
function injectGutterStyles() {
  if (gutterStylesInjected) return;
  gutterStylesInjected = true;

  const style = document.createElement("style");
  style.id = "git-gutter-monaco-styles";
  style.textContent = `
    /* Added line indicator - green bar in gutter */
    .${GUTTER_ADDED_CLASS} {
      background-color: rgba(40, 167, 69, 0.8);
      width: 3px !important;
      margin-left: 3px;
    }

    /* Modified line indicator - blue bar in gutter */
    .${GUTTER_MODIFIED_CLASS} {
      background-color: rgba(0, 122, 204, 0.8);
      width: 3px !important;
      margin-left: 3px;
    }
  `;
  document.head.appendChild(style);
  console.log("[GitGutter] Injected gutter styles");
}

/**
 * Hook that adds git gutter decorations to Monaco editor
 */
export function useGitGutter({
  editor,
  monaco,
  filePath,
  enabled = true,
}: UseGitGutterOptions) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const { loadHeadContent, headContent, headContentLoading, refreshHeadContent } = useGitStore();

  // Track file dirty state for refresh on save
  const openFile = useFilesStore((s) => s.openFiles.find((f) => f.path === filePath));
  const isDirty = openFile?.isDirty ?? false;
  const wasDirtyRef = useRef<boolean>(false);

  // Store decoration IDs for cleanup
  const decorationsRef = useRef<string[]>([]);

  // Use shared line diff hook
  const { lineDiff, hasChanges, addedCount, modifiedCount } = useLineDiff({ filePath });

  // Load HEAD content when file opens
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Load HEAD content if not cached
    if (headContent[filePath] === undefined && !headContentLoading[filePath]) {
      loadHeadContent(projectContext.projectPath, filePath);
    }
  }, [enabled, projectContext, filePath, headContent, headContentLoading, loadHeadContent]);

  // Refresh HEAD content when file is saved
  useEffect(() => {
    if (!enabled || !projectContext || !filePath) return;

    // Detect save: was dirty, now clean - refresh HEAD content
    if (wasDirtyRef.current && !isDirty) {
      console.log("[GitGutter] File saved, refreshing HEAD content for:", filePath);
      refreshHeadContent(projectContext.projectPath, filePath);
    }

    wasDirtyRef.current = isDirty;
  }, [enabled, projectContext, filePath, isDirty, refreshHeadContent]);

  // Apply gutter decorations
  useEffect(() => {
    if (!editor || !monaco || !enabled) {
      return;
    }

    // Inject styles if needed
    injectGutterStyles();

    // Clear existing decorations
    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }

    // If no diff or no changes, nothing to show
    if (!lineDiff || !hasChanges) {
      return;
    }

    // Build decorations for added/modified lines
    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const mapping of lineDiff.mappings) {
      if (mapping.status === "added") {
        decorations.push({
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
        decorations.push({
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
    if (decorations.length > 0) {
      decorationsRef.current = editor.deltaDecorations([], decorations);
    }

    return () => {
      // Cleanup decorations on unmount
      if (decorationsRef.current.length > 0 && editor) {
        try {
          decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        } catch {
          // Editor may be disposed
        }
      }
    };
  }, [editor, monaco, enabled, lineDiff, hasChanges]);

  // Cleanup on file change
  useEffect(() => {
    return () => {
      if (decorationsRef.current.length > 0 && editor) {
        try {
          decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        } catch {
          // Editor may be disposed
        }
      }
    };
  }, [editor, filePath]);

  return {
    hasChanges,
    addedCount,
    modifiedCount,
  };
}
