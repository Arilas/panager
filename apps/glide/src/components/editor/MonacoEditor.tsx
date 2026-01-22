/**
 * Monaco Editor Wrapper Component
 *
 * Thin wrapper around @monaco-editor/react.
 * All initialization and configuration happens in the monaco/ module.
 */

import { useCallback } from "react";
import Editor, { OnChange } from "@monaco-editor/react";
import { useTabsStore } from "../../stores/tabs";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { useEditorSettings } from "../../stores/settings";
import { useEditor } from "../../hooks/useEditor";
import { getMonacoTheme } from "../../monaco";
import { mapMonacoToShikiLanguage } from "../../lib/languageMapping";
import { buildFileUrl } from "../../lib/tabs/url";
import { cn } from "../../lib/utils";

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
  readOnly = false,
}: MonacoEditorProps) {
  const effectiveTheme = useEffectiveTheme();
  const editorSettings = useEditorSettings();
  const updateContent = useTabsStore((s) => s.updateContent);

  // Build URL for content updates
  const url = buildFileUrl(path);

  // Use the new editor hook
  const { onMount, isLoading, hasError } = useEditor({
    filePath: path,
    language,
  });

  const isDark = effectiveTheme === "dark";
  const monacoTheme = getMonacoTheme(isDark);

  // Map Monaco language ID to Shiki language ID for proper tokenization
  const shikiLanguage = mapMonacoToShikiLanguage(language);

  // Handle content changes
  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined && value !== content) {
        updateContent(url, value);
      }
    },
    [url, content, updateContent],
  );

  // Show error state
  if (hasError) {
    return (
      <div
        className={cn(
          "h-full w-full flex flex-col items-center justify-center gap-4",
          isDark
            ? "bg-neutral-900 text-neutral-300"
            : "bg-white text-neutral-600",
        )}
      >
        <div className="text-red-500">Failed to load editor</div>
        <button
          onClick={() => window.location.reload()}
          className={cn(
            "px-4 py-2 rounded text-sm",
            isDark
              ? "bg-neutral-700 hover:bg-neutral-600"
              : "bg-neutral-200 hover:bg-neutral-300",
          )}
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={shikiLanguage}
        value={content}
        path={path}
        theme={monacoTheme}
        onMount={onMount}
        onChange={handleEditorChange}
        options={{
          readOnly,
          minimap: {
            enabled: editorSettings.minimap.enabled,
            side: editorSettings.minimap.side,
          },
          fontSize: editorSettings.fontSize,
          fontFamily: editorSettings.fontFamily,
          lineNumbers: editorSettings.lineNumbers,
          scrollBeyondLastLine: editorSettings.scrollBeyondLastLine,
          automaticLayout: true,
          wordWrap: editorSettings.wordWrap,
          wordWrapColumn: editorSettings.wordWrapColumn,
          tabSize: editorSettings.tabSize,
          insertSpaces: editorSettings.insertSpaces,
          renderWhitespace: editorSettings.renderWhitespace,
          bracketPairColorization: {
            enabled: editorSettings.bracketPairColorization.enabled,
          },
          guides: {
            bracketPairs: editorSettings.guides.bracketPairs,
            indentation: editorSettings.guides.indentation,
          },
          smoothScrolling: editorSettings.smoothScrolling,
          cursorBlinking: editorSettings.cursorBlinking,
          cursorStyle: editorSettings.cursorStyle,
          cursorSmoothCaretAnimation: editorSettings.cursorSmoothCaretAnimation,
          lineHeight: editorSettings.lineHeight || undefined,
          letterSpacing: editorSettings.letterSpacing || undefined,
          padding: {
            top: editorSettings.padding.top,
            bottom: editorSettings.padding.bottom,
          },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          // Disable shadow DOM so we can style widgets
          useShadowDOM: false,
        }}
        loading={
          <div
            className={cn(
              "h-full w-full flex items-center justify-center",
              isDark
                ? "bg-neutral-900 text-neutral-500"
                : "bg-white text-neutral-400",
            )}
          >
            {isLoading ? "Initializing editor..." : "Loading editor..."}
          </div>
        }
      />
    </div>
  );
}
