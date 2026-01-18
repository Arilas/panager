/**
 * Monaco Editor Wrapper Component
 *
 * Uses @monaco-editor/react for proper Monaco integration with syntax highlighting.
 * Supports light/dark theme switching based on app settings.
 */

import { useRef, useCallback } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";

// Configure Monaco loader to use CDN (simplest setup)
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs",
  },
});

interface MonacoEditorProps {
  content: string;
  language: string;
  path: string;
  readOnly?: boolean;
}

export function MonacoEditor({
  content,
  language,
  path,
  readOnly = true,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const monacoTheme = isDark ? "vs-dark" : "vs";

  const handleEditorMount: OnMount = useCallback(
    (editor, _monaco) => {
      editorRef.current = editor;

      // Set initial cursor position
      setCursorPosition({ line: 1, column: 1 });

      // Listen for cursor position changes
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      // Focus the editor
      editor.focus();
    },
    [setCursorPosition]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={content}
        path={path}
        theme={monacoTheme}
        onMount={handleEditorMount}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "off",
          tabSize: 2,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        loading={
          <div
            className={cn(
              "h-full w-full flex items-center justify-center",
              isDark ? "bg-neutral-900 text-neutral-500" : "bg-white text-neutral-400"
            )}
          >
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
