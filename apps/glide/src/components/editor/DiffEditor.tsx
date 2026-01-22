/**
 * Monaco Diff Editor Component
 *
 * Shows side-by-side diff view for Git changes.
 */

import { useRef, useCallback } from "react";
import { DiffEditor as MonacoDiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useIdeStore } from "../../stores/ide";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { mapMonacoToShikiLanguage } from "../../lib/languageMapping";
import { getMonacoTheme } from "../../monaco/themes";

interface DiffEditorProps {
  original: string;
  modified: string;
  language: string;
  path: string;
}

export function DiffEditor({
  original,
  modified,
  language,
  path: _path,
}: DiffEditorProps) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);
  const effectiveTheme = useEffectiveTheme();

  const isDark = effectiveTheme === "dark";
  const monacoTheme = getMonacoTheme(isDark);
  // Map Monaco language ID to Shiki language ID for proper tokenization
  const shikiLanguage = mapMonacoToShikiLanguage(language);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      editorRef.current = editor;

      // Set initial cursor position
      setCursorPosition({ line: 1, column: 1 });

      // Listen for cursor position changes on the modified editor
      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditor.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });
    },
    [setCursorPosition],
  );

  return (
    <div className="h-full w-full">
      <MonacoDiffEditor
        height="100%"
        language={shikiLanguage}
        original={original}
        modified={modified}
        theme={monacoTheme}
        onMount={handleEditorMount}
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "off",
          renderOverviewRuler: true,
          diffWordWrap: "off",
          originalEditable: false,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-neutral-500">
            Loading diff editor...
          </div>
        }
      />
    </div>
  );
}
