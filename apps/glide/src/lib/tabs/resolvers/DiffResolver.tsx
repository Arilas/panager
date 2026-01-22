/**
 * Diff Resolver
 *
 * Handles diff:// URLs for git diff views.
 */

import type { ComponentType, ReactElement } from "react";
import { GitCompareArrows } from "lucide-react";
import type {
  TabResolver,
  ResolvedTabState,
  DiffTabData,
  TabComponentProps,
  TabErrorProps,
} from "../types";
import { parseDiffUrl, isDiffUrl } from "../url";
import { getFileDiff } from "../../tauri-ide";
import { getLanguageFromExtension } from "../../languageMapping";
import { DiffTabContent } from "../../../components/editor/DiffTabContent";
import { FileTabError } from "../../../components/editor/FileTabError";

/**
 * Diff Resolver
 *
 * Handles loading and displaying git diffs.
 */
export class DiffResolver implements TabResolver<DiffTabData> {
  readonly id = "diff";
  readonly priority = 0;
  readonly schemes = ["diff"] as const;

  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  canResolve(url: string): boolean {
    return isDiffUrl(url);
  }

  getDisplayName(url: string): string {
    try {
      const { filePath, staged } = parseDiffUrl(url);
      const fileName = filePath.split("/").pop() || filePath;
      return `${fileName} (${staged ? "Staged" : "Changes"})`;
    } catch {
      return url;
    }
  }

  toFilePath(url: string): string | null {
    try {
      const { filePath } = parseDiffUrl(url);
      return filePath;
    } catch {
      return null;
    }
  }

  getComponent(): ComponentType<TabComponentProps<DiffTabData>> {
    return DiffTabContent;
  }

  getErrorComponent(): ComponentType<TabErrorProps> {
    return FileTabError;
  }

  getIcon(_url: string, className?: string): ReactElement {
    return <GitCompareArrows className={className} />;
  }

  async resolve(url: string): Promise<ResolvedTabState<DiffTabData>> {
    const { filePath, staged } = parseDiffUrl(url);

    // Fetch diff content from git
    const diff = await getFileDiff(this.projectPath, filePath, staged);

    // Get language from file extension
    const extension = filePath.split(".").pop() || "";
    const language = getLanguageFromExtension(extension);

    return {
      url,
      type: this.id,
      displayName: this.getDisplayName(url),
      data: {
        filePath,
        originalContent: diff.originalContent,
        modifiedContent: diff.modifiedContent,
        language,
        staged,
      },
    };
  }

  async onExternalChange(url: string): Promise<ResolvedTabState<DiffTabData> | null> {
    // Re-resolve to get updated diff
    try {
      return await this.resolve(url);
    } catch {
      // File may have been committed or changes discarded
      return null;
    }
  }
}
