/**
 * Markdown Editor Component
 *
 * A split-view editor for markdown files with three viewing modes:
 * - Source only (editor)
 * - Side-by-side (editor + preview)
 * - Preview only
 *
 * Uses Monaco for editing and markdown-it with Shiki for preview rendering.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import Editor, { OnChange } from "@monaco-editor/react";
import MarkdownIt from "markdown-it";
import { fromHighlighter } from "@shikijs/markdown-it/core";
import {
  createHighlighter,
  type HighlighterGeneric,
  type BundledLanguage,
  type BundledTheme,
} from "shiki";
import { Code, Columns2, Eye } from "lucide-react";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { useEditorSettings } from "../../stores/settings";
import { useTabsStore } from "../../stores/tabs";
import { useEditor } from "../../hooks/useEditor";
import { getMonacoTheme } from "../../monaco";
import { buildFileUrl } from "../../lib/tabs/url";
import { cn } from "../../lib/utils";
import type { TabComponentProps, MarkdownTabData } from "../../lib/tabs/types";

/** Preview mode options */
type PreviewMode = "source" | "split" | "preview";

// Lazy-loaded highlighter instance (shared with MarkdownContent)
let highlighterPromise: Promise<
  HighlighterGeneric<BundledLanguage, BundledTheme>
> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    // TODO: We need shared highlighter instance for all markdown editors
    highlighterPromise = createHighlighter({
      // TODO: We need to add configuration for theme globally
      themes: ["github-dark", "github-light"],
      // TODO: We need to centralize the languages we support
      langs: [
        "typescript",
        "javascript",
        "tsx",
        "jsx",
        "json",
        "html",
        "css",
        "markdown",
        "bash",
        "shell",
        "python",
        "rust",
        "go",
        "yaml",
        "toml",
        "sql",
        "diff",
      ],
    });
  }
  return highlighterPromise;
}

function createMarkdownParser() {
  return new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
  });
}

interface PreviewModeButtonProps {
  mode: PreviewMode;
  currentMode: PreviewMode;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  isDark: boolean;
}

function PreviewModeButton({
  mode,
  currentMode,
  onClick,
  icon,
  title,
  isDark,
}: PreviewModeButtonProps) {
  const isActive = mode === currentMode;

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive
          ? isDark
            ? "bg-neutral-600 text-white"
            : "bg-neutral-300 text-neutral-900"
          : isDark
            ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
            : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200",
      )}
    >
      {icon}
    </button>
  );
}

interface MarkdownPreviewProps {
  content: string;
  isDark: boolean;
}

function MarkdownPreview({ content, isDark }: MarkdownPreviewProps) {
  const [highlighter, setHighlighter] = useState<HighlighterGeneric<
    BundledLanguage,
    BundledTheme
  > | null>(null);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  const md = useMemo(() => {
    const parser = createMarkdownParser();

    if (highlighter) {
      parser.use(
        fromHighlighter(highlighter, {
          theme: isDark ? "github-dark" : "github-light",
        }),
      );
    }

    return parser;
  }, [highlighter, isDark]);

  const html = md.render(content);

  return (
    <div
      className={cn(
        "h-full overflow-auto p-6",
        isDark ? "bg-neutral-900" : "bg-white",
      )}
    >
      <div
        className={cn(
          "markdown-content prose prose-sm max-w-none",
          isDark ? "prose-invert" : "",
          // Heading styles
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4",
          "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3",
          isDark ? "[&_h1]:border-neutral-700" : "[&_h1]:border-neutral-200",
          // Paragraph and text
          "[&_p]:mb-3 [&_p]:leading-relaxed",
          // Lists
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1",
          "[&_li]:leading-relaxed",
          // Links
          "[&_a]:underline [&_a]:underline-offset-2",
          isDark
            ? "[&_a]:text-blue-400 hover:[&_a]:text-blue-300"
            : "[&_a]:text-blue-600 hover:[&_a]:text-blue-700",
          // Blockquotes
          "[&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:italic",
          isDark
            ? "[&_blockquote]:border-neutral-600 [&_blockquote]:text-neutral-400"
            : "[&_blockquote]:border-neutral-300 [&_blockquote]:text-neutral-600",
          // Horizontal rules
          "[&_hr]:my-6 [&_hr]:border-t",
          isDark ? "[&_hr]:border-neutral-700" : "[&_hr]:border-neutral-200",
          // Inline code
          "[&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[0.9em]",
          isDark
            ? "[&_code:not(pre_code)]:bg-neutral-800 [&_code:not(pre_code)]:text-pink-400"
            : "[&_code:not(pre_code)]:bg-neutral-100 [&_code:not(pre_code)]:text-pink-600",
          // Code blocks
          "[&_pre]:my-4 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm",
          isDark ? "[&_pre]:bg-[#0d1117]" : "[&_pre]:bg-[#f6f8fa]",
          // Tables
          "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse",
          "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border",
          "[&_td]:px-3 [&_td]:py-2 [&_td]:border",
          isDark
            ? "[&_th]:border-neutral-700 [&_td]:border-neutral-700 [&_thead]:bg-neutral-800"
            : "[&_th]:border-neutral-200 [&_td]:border-neutral-200 [&_thead]:bg-neutral-50",
          // Images
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded",
          // Task lists
          "[&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-blue-500",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function MarkdownEditor({ data }: TabComponentProps<MarkdownTabData>) {
  const effectiveTheme = useEffectiveTheme();
  const editorSettings = useEditorSettings();
  const updateContent = useTabsStore((s) => s.updateContent);

  const isDark = effectiveTheme === "dark";
  const monacoTheme = getMonacoTheme(isDark);

  // Build URL for content updates
  const url = buildFileUrl(data.path);

  // Preview mode state - default to split for markdown
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    data.showPreview ? "split" : "source",
  );

  // Track current content for preview
  const [currentContent, setCurrentContent] = useState(data.currentContent);

  // Use the editor hook for Monaco setup
  const { onMount, isLoading, hasError } = useEditor({
    filePath: data.path,
    language: "markdown",
  });

  // Handle content changes
  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined) {
        setCurrentContent(value);
        if (value !== data.currentContent) {
          updateContent(url, value);
        }
      }
    },
    [url, data.currentContent, updateContent],
  );

  // Sync content when data changes externally
  useEffect(() => {
    setCurrentContent(data.currentContent);
  }, [data.currentContent]);

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
    <div className="h-full w-full flex flex-col">
      {/* Toolbar with preview mode toggle */}
      <div
        className={cn(
          "flex items-center justify-end gap-1 px-2 py-1 border-b",
          isDark
            ? "bg-neutral-800 border-neutral-700"
            : "bg-neutral-100 border-neutral-200",
        )}
      >
        <PreviewModeButton
          mode="source"
          currentMode={previewMode}
          onClick={() => setPreviewMode("source")}
          icon={<Code className="w-4 h-4" />}
          title="Source only"
          isDark={isDark}
        />
        <PreviewModeButton
          mode="split"
          currentMode={previewMode}
          onClick={() => setPreviewMode("split")}
          icon={<Columns2 className="w-4 h-4" />}
          title="Split view"
          isDark={isDark}
        />
        <PreviewModeButton
          mode="preview"
          currentMode={previewMode}
          onClick={() => setPreviewMode("preview")}
          icon={<Eye className="w-4 h-4" />}
          title="Preview only"
          isDark={isDark}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex">
        {/* Editor pane */}
        {previewMode !== "preview" && (
          <div
            className={cn(
              "h-full min-w-0",
              previewMode === "split" ? "w-1/2" : "w-full",
            )}
          >
            {/* TODO: We need to have a shared helper to configure the editor options */}
            <Editor
              height="100%"
              language="markdown"
              value={currentContent}
              path={data.path}
              theme={monacoTheme}
              onMount={onMount}
              onChange={handleEditorChange}
              options={{
                minimap: {
                  enabled: editorSettings.minimap.enabled,
                  side: editorSettings.minimap.side,
                },
                fontSize: editorSettings.fontSize,
                fontFamily: editorSettings.fontFamily,
                lineNumbers: editorSettings.lineNumbers,
                scrollBeyondLastLine: editorSettings.scrollBeyondLastLine,
                automaticLayout: true,
                wordWrap: "on", // Always wrap for markdown
                tabSize: editorSettings.tabSize,
                insertSpaces: editorSettings.insertSpaces,
                renderWhitespace: editorSettings.renderWhitespace,
                smoothScrolling: editorSettings.smoothScrolling,
                cursorBlinking: editorSettings.cursorBlinking,
                cursorStyle: editorSettings.cursorStyle,
                cursorSmoothCaretAnimation:
                  editorSettings.cursorSmoothCaretAnimation,
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
        )}

        {/* Divider for split view.
        TODO: Ability to resize the divider */}
        {previewMode === "split" && (
          <div
            className={cn(
              "w-px flex-shrink-0",
              isDark ? "bg-neutral-700" : "bg-neutral-200",
            )}
          />
        )}

        {/* Preview pane */}
        {previewMode !== "source" && (
          <div
            className={cn(
              "h-full min-w-0 overflow-hidden",
              previewMode === "split" ? "w-1/2" : "w-full",
            )}
          >
            <MarkdownPreview content={currentContent} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
}
