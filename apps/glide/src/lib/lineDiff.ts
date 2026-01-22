/**
 * Line-based diff utilities for tracking blame through edits
 *
 * Uses jsdiff to compute line mappings between original and modified content,
 * allowing us to show accurate blame for unchanged lines while marking
 * new/modified lines as uncommitted.
 */

import { diffLines } from "diff";

/** Status of a line in the current document */
export type LineStatus = "unchanged" | "modified" | "added";

/** Mapping from current line number to original line number (or null if new/modified) */
export interface LineMapping {
  /** Current line number (1-indexed) */
  currentLine: number;
  /** Original line number (1-indexed), or null if this is a new/modified line */
  originalLine: number | null;
  /** Status of this line */
  status: LineStatus;
}

/** Result of computing a diff between original and current content */
export interface LineDiffResult {
  /** Mapping for each line in the current document */
  mappings: LineMapping[];
  /** Whether the document has any changes */
  hasChanges: boolean;
  /** Number of added lines */
  addedCount: number;
  /** Number of modified lines */
  modifiedCount: number;
  /** Number of unchanged lines */
  unchangedCount: number;
}

/**
 * Compute line mappings between original and current content.
 *
 * This allows us to:
 * 1. Show original blame for unchanged lines (even if they shifted)
 * 2. Show "uncommitted" indicator for new/modified lines
 *
 * @param originalContent - The content when blame was loaded
 * @param currentContent - The current editor content
 * @returns Line mappings and statistics
 */
export function computeLineDiff(
  originalContent: string,
  currentContent: string
): LineDiffResult {
  // Fast path: no changes
  if (originalContent === currentContent) {
    const lineCount = currentContent.split("\n").length;
    const mappings: LineMapping[] = [];
    for (let i = 1; i <= lineCount; i++) {
      mappings.push({
        currentLine: i,
        originalLine: i,
        status: "unchanged",
      });
    }
    return {
      mappings,
      hasChanges: false,
      addedCount: 0,
      modifiedCount: 0,
      unchangedCount: lineCount,
    };
  }

  // Compute line-by-line diff
  const changes = diffLines(originalContent, currentContent);

  const mappings: LineMapping[] = [];
  let currentLineNum = 1;
  let originalLineNum = 1;
  let addedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  // Track pending removed lines to detect modifications (remove + add pairs)
  let pendingRemovedCount = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = change.value.split("\n");
    // Remove the last empty string if the chunk ends with newline
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    if (change.removed) {
      // Track removed lines - they might be modifications if followed by adds
      pendingRemovedCount = lines.length;
      originalLineNum += lines.length;
    } else if (change.added) {
      // Check if this is a modification (preceded by removed lines)
      const modifiedLines = Math.min(pendingRemovedCount, lines.length);
      const pureAddedLines = lines.length - modifiedLines;

      // First, mark modified lines (replacing removed lines)
      for (let j = 0; j < modifiedLines; j++) {
        mappings.push({
          currentLine: currentLineNum,
          originalLine: null,
          status: "modified",
        });
        currentLineNum++;
        modifiedCount++;
      }

      // Then, mark purely added lines
      for (let j = 0; j < pureAddedLines; j++) {
        mappings.push({
          currentLine: currentLineNum,
          originalLine: null,
          status: "added",
        });
        currentLineNum++;
        addedCount++;
      }

      pendingRemovedCount = 0;
    } else {
      // Unchanged lines - reset pending removed count
      pendingRemovedCount = 0;

      for (const _ of lines) {
        mappings.push({
          currentLine: currentLineNum,
          originalLine: originalLineNum,
          status: "unchanged",
        });
        currentLineNum++;
        originalLineNum++;
        unchangedCount++;
      }
    }
  }

  return {
    mappings,
    hasChanges: addedCount > 0 || modifiedCount > 0,
    addedCount,
    modifiedCount,
    unchangedCount,
  };
}

/**
 * Get the original line number for a current line number.
 *
 * @param mappings - Line mappings from computeLineDiff
 * @param currentLine - Current line number (1-indexed)
 * @returns Original line number if unchanged, or null if new/modified
 */
export function getOriginalLineNumber(
  mappings: LineMapping[],
  currentLine: number
): number | null {
  const mapping = mappings[currentLine - 1];
  return mapping?.originalLine ?? null;
}

/**
 * Get the status of a line in the current document.
 *
 * @param mappings - Line mappings from computeLineDiff
 * @param currentLine - Current line number (1-indexed)
 * @returns Line status
 */
export function getLineStatus(
  mappings: LineMapping[],
  currentLine: number
): LineStatus {
  const mapping = mappings[currentLine - 1];
  return mapping?.status ?? "added";
}
