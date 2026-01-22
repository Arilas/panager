/**
 * File Resolver
 *
 * Handles file:// URLs for regular code files.
 * Priority 0 (default) - other resolvers like MarkdownResolver
 * can override for specific file types.
 */

import type { ComponentType, ReactElement } from "react";
import { File } from "lucide-react";
import type {
  TabResolver,
  ResolvedTabState,
  FileTabData,
  TabComponentProps,
  TabErrorProps,
} from "../types";
import { parseFileUrl, isFileUrl } from "../url";
import { readFile, gitShowHead } from "../../tauri-ide";
import { FileTabContent } from "../../../components/editor/FileTabContent";
import { FileTabError } from "../../../components/editor/FileTabError";

/**
 * File Resolver
 *
 * Handles loading and displaying code files.
 */
export class FileResolver implements TabResolver<FileTabData> {
  readonly id = "file";
  readonly priority = 0;
  readonly schemes = ["file"] as const;

  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  canResolve(url: string): boolean {
    return isFileUrl(url);
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

  getComponent(): ComponentType<TabComponentProps<FileTabData>> {
    return FileTabContent;
  }

  getErrorComponent(): ComponentType<TabErrorProps> {
    return FileTabError;
  }

  getIcon(_url: string, className?: string): ReactElement {
    return <File className={className} />;
  }

  async resolve(url: string): Promise<ResolvedTabState<FileTabData>> {
    const path = parseFileUrl(url);

    // Fetch file content from backend
    const fileResult = await readFile(path);

    if (fileResult.isBinary) {
      throw new Error(`Cannot open binary file: ${path}`);
    }

    // Try to get HEAD content for inline diff (optional, don't fail if not available)
    let headContent: string | null = null;
    try {
      const headResult = await gitShowHead(this.projectPath, path);
      if (headResult) {
        headContent = headResult;
      }
    } catch {
      // Ignore - file may not be in git or no HEAD content
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
        language: fileResult.language,
      },
    };
  }

  async onExternalChange(url: string): Promise<ResolvedTabState<FileTabData> | null> {
    // Re-resolve to get fresh content
    try {
      return await this.resolve(url);
    } catch {
      // File may have been deleted
      return null;
    }
  }
}
