/**
 * Markdown Content - Renders markdown text with code highlighting
 *
 * Uses markdown-it for parsing with Shiki for syntax highlighting.
 * Supports GFM (tables, strikethrough, task lists, etc).
 */

import { useEffect, useState, useMemo } from "react";
import MarkdownIt from "markdown-it";
import { fromHighlighter } from "@shikijs/markdown-it/core";
import { createHighlighter, type HighlighterGeneric, type BundledLanguage, type BundledTheme } from "shiki";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";

interface MarkdownContentProps {
  content: string;
}

// Lazy-loaded highlighter instance
let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
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

// Create base markdown-it instance with GFM-like features
function createMarkdownParser() {
  return new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  });
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const [highlighter, setHighlighter] = useState<HighlighterGeneric<BundledLanguage, BundledTheme> | null>(null);

  // Load highlighter on mount
  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  // Create markdown parser with Shiki when available
  const md = useMemo(() => {
    const parser = createMarkdownParser();

    if (highlighter) {
      parser.use(
        fromHighlighter(highlighter, {
          theme: isDark ? "github-dark" : "github-light",
        })
      );
    }

    return parser;
  }, [highlighter, isDark]);

  // Render markdown
  const html = md.render(content);

  return (
    <div
      className={cn(
        "markdown-content prose prose-sm max-w-none",
        isDark ? "prose-invert" : "",
        // Custom styling overrides
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2",
        "[&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2",
        "[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-1",
        "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-1",
        "[&_a]:underline [&_a]:underline-offset-2",
        isDark
          ? "[&_a]:text-blue-400 hover:[&_a]:text-blue-300"
          : "[&_a]:text-blue-600 hover:[&_a]:text-blue-700",
        "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic",
        isDark
          ? "[&_blockquote]:border-white/20 [&_blockquote]:text-neutral-400"
          : "[&_blockquote]:border-black/10 [&_blockquote]:text-neutral-500",
        "[&_hr]:my-3 [&_hr]:border-t",
        isDark ? "[&_hr]:border-white/10" : "[&_hr]:border-black/10",
        "[&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[0.9em]",
        isDark
          ? "[&_code:not(pre_code)]:bg-white/10 [&_code:not(pre_code)]:text-pink-400"
          : "[&_code:not(pre_code)]:bg-black/5 [&_code:not(pre_code)]:text-pink-600",
        "[&_pre]:my-2 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-xs",
        isDark ? "[&_pre]:bg-[#0d1117]" : "[&_pre]:bg-[#f6f8fa]",
        // Table styling
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_th]:border",
        "[&_td]:px-2 [&_td]:py-1 [&_td]:border",
        isDark
          ? "[&_th]:border-white/10 [&_td]:border-white/10 [&_thead]:bg-white/5"
          : "[&_th]:border-black/10 [&_td]:border-black/10 [&_thead]:bg-black/5",
        // Task list styling
        "[&_input[type=checkbox]]:mr-2"
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
