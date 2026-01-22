/**
 * Markdown Resolver
 *
 * Handles file:// URLs for markdown files (.md, .mdx).
 * Higher priority than FileResolver to intercept markdown files.
 * Provides a split view with editor and preview.
 */

import type { ComponentType, ReactElement } from "react";
import { FileText } from "lucide-react";
import type {
  TabResolver,
  ResolvedTabState,
  MarkdownTabData,
  TabComponentProps,
  TabErrorProps,
} from "../types";
import { parseFileUrl, isFileUrl, getExtensionFromUrl } from "../url";
import { readFile, gitShowHead } from "../../tauri-ide";
import { MarkdownEditor } from "../../../components/editor/MarkdownEditor";
import { FileTabError } from "../../../components/editor/FileTabError";

/** Markdown file extensions */
const MARKDOWN_EXTENSIONS = new Set(["md", "mdx", "markdown"]);

/**
 * Markdown Resolver
 *
 * Handles markdown files with preview support.
 * Priority 10 - higher than FileResolver (0) to intercept markdown files.
 */
export class MarkdownResolver implements TabResolver<MarkdownTabData> {
  readonly id = "markdown";
  readonly priority = 10;
  readonly schemes = ["file"] as const;

  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  canResolve(url: string): boolean {
    if (!isFileUrl(url)) return false;

    const extension = getExtensionFromUrl(url);
    return MARKDOWN_EXTENSIONS.has(extension);
  }

  getDisplayName(url: string): string {
    try {
      const path = parseFileUrl(url);
      return path.split("/").pop() || path;
    } catch {
      return url;
    }
  }

  toFilePath(url: string): string | null {
    try {
      return parseFileUrl(url);
    } catch {
      return null;
    }
  }

  getComponent(): ComponentType<TabComponentProps<MarkdownTabData>> {
    return MarkdownEditor;
  }

  getErrorComponent(): ComponentType<TabErrorProps> {
    return FileTabError;
  }

  getIcon(_url: string, className?: string): ReactElement {
    return <FileText className={className} />;
  }

  async resolve(url: string): Promise<ResolvedTabState<MarkdownTabData>> {
    const path = parseFileUrl(url);

    // Fetch file content from backend
    const fileResult = await readFile(path);

    if (fileResult.isBinary) {
      throw new Error(`Cannot open binary file: ${path}`);
    }

    // Try to get HEAD content for inline diff (optional)
    let headContent: string | null = null;
    try {
      const headResult = await gitShowHead(this.projectPath, path);
      if (headResult) {
        headContent = headResult;
      }
    } catch {
      // Ignore - file may not be in git
    }

    return {
      url,
      type: this.id,
      displayName: this.getDisplayName(url),
      data: {
        path,
        currentContent: fileResult.content,
        savedContent: fileResult.content,
        headContent,
        language: "markdown",
        showPreview: true, // Default to showing preview for markdown
      },
    };
  }

  async onExternalChange(url: string): Promise<ResolvedTabState<MarkdownTabData> | null> {
    try {
      return await this.resolve(url);
    } catch {
      return null;
    }
  }
}
