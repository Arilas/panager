/**
 * Hook for computing line diff between original (committed) and current content
 *
 * This hook computes the diff once and can be shared across multiple consumers
 * (git blame, CodeLens, gutter decorations, etc.)
 */

import { useMemo } from "react";
import { useGitStore } from "../stores/git";
import { useFilesStore } from "../stores/files";
import { computeLineDiff, type LineDiffResult } from "../lib/lineDiff";

interface UseLineDiffOptions {
  filePath: string;
}

interface UseLineDiffResult {
  /** The computed line diff, or null if not available */
  lineDiff: LineDiffResult | null;
  /** The content from HEAD (last committed version) */
  headContent: string | null;
  /** The current content in the editor */
  currentContent: string;
  /** Whether the file has uncommitted changes */
  hasChanges: boolean;
  /** Number of added lines */
  addedCount: number;
  /** Number of modified lines */
  modifiedCount: number;
}

/**
 * Hook that computes and returns line diff between HEAD content and current content.
 * The diff is memoized and only recomputed when content changes.
 */
export function useLineDiff({ filePath }: UseLineDiffOptions): UseLineDiffResult {
  const { getHeadContent } = useGitStore();

  // Get current file content from store
  const openFile = useFilesStore((s) => s.openFiles.find((f) => f.path === filePath));
  const currentContent = openFile?.content ?? "";

  // Get HEAD content (last committed version)
  const headContent = getHeadContent(filePath);

  // Compute diff - memoized to avoid recalculation
  const lineDiff = useMemo<LineDiffResult | null>(() => {
    if (headContent === null || !currentContent) return null;
    return computeLineDiff(headContent, currentContent);
  }, [headContent, currentContent]);

  return {
    lineDiff,
    headContent,
    currentContent,
    hasChanges: lineDiff?.hasChanges ?? false,
    addedCount: lineDiff?.addedCount ?? 0,
    modifiedCount: lineDiff?.modifiedCount ?? 0,
  };
}
