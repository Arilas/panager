/**
 * Hook for reading line diff from editor store
 *
 * Simplified hook that reads lineDiff data from the centralized editorStore.
 * The diff computation happens in the store when content or HEAD content changes.
 */

import { useEditorStore } from "../stores/editor";
import type { LineDiffResult } from "../lib/lineDiff";

interface UseLineDiffOptions {
  filePath: string;
}

interface UseLineDiffResult {
  /** The computed line diff, or null if not available */
  lineDiff: LineDiffResult | null;
  /** Whether the file has uncommitted changes */
  hasChanges: boolean;
  /** Number of added lines */
  addedCount: number;
  /** Number of modified lines */
  modifiedCount: number;
}

/**
 * Hook that returns line diff for a file from the editor store.
 * The diff is computed in the store when content changes.
 */
export function useLineDiff({ filePath }: UseLineDiffOptions): UseLineDiffResult {
  const fileState = useEditorStore((s) => s.getFileState(filePath));
  const lineDiff = fileState?.lineDiff ?? null;

  return {
    lineDiff,
    hasChanges: lineDiff?.hasChanges ?? false,
    addedCount: lineDiff?.addedCount ?? 0,
    modifiedCount: lineDiff?.modifiedCount ?? 0,
  };
}
