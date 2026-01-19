/**
 * useRevealActiveFile Hook
 *
 * Automatically reveals the active file in the file tree when:
 * - The active tab changes
 * - The file is not already visible in the viewport
 * - No part of the file's path is gitignored
 */

import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "../stores/editor";
import { useFilesStore } from "../stores/files";
import { useIdeStore } from "../stores/ide";
import type { FileEntry } from "../types";

const REVEAL_DEBOUNCE_MS = 150;

interface UseRevealActiveFileOptions {
  /** The container element that scrolls (the tree viewport) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether revealing is enabled */
  enabled?: boolean;
}

/**
 * Recursively find an entry in the tree by path.
 */
function findEntryInTree(
  tree: FileEntry[],
  targetPath: string
): FileEntry | null {
  for (const entry of tree) {
    if (entry.path === targetPath) {
      return entry;
    }
    if (entry.children) {
      const found = findEntryInTree(entry.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Check if any segment of a path is gitignored by traversing the tree.
 * Returns true if ANY parent directory OR the file itself is gitignored.
 */
function isPathOrAncestorGitignored(
  tree: FileEntry[],
  targetPath: string,
  projectPath: string
): boolean {
  // Build list of all path segments to check
  const relativePath = targetPath.startsWith(projectPath + "/")
    ? targetPath.slice(projectPath.length + 1)
    : targetPath;
  const segments = relativePath.split("/");
  let currentPath = projectPath;

  for (let i = 0; i < segments.length; i++) {
    currentPath = currentPath + "/" + segments[i];
    const entry = findEntryInTree(tree, currentPath);
    if (entry?.isGitignored) {
      return true;
    }
  }

  return false;
}

/**
 * Get all parent directory paths for a file path.
 * Returns paths in top-down order (closest to root first).
 */
function getParentPaths(filePath: string, projectPath: string): string[] {
  const parents: string[] = [];
  let current = filePath;

  while (true) {
    const lastSlash = current.lastIndexOf("/");
    if (lastSlash <= 0 || current === projectPath) break;
    current = current.substring(0, lastSlash);
    if (current !== projectPath && current.length > projectPath.length) {
      parents.unshift(current); // Add to beginning for top-down order
    }
  }

  return parents;
}

/**
 * Check if an element is visible within its scroll container using Intersection Observer.
 */
function checkElementVisibility(
  element: HTMLElement,
  container: HTMLElement
): Promise<boolean> {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver(
      (entries) => {
        observer.disconnect();
        // Consider visible if at least 50% of element is visible
        resolve(
          entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5
        );
      },
      {
        root: container,
        threshold: 0.5,
      }
    );
    observer.observe(element);
  });
}

export function useRevealActiveFile({
  containerRef,
  enabled = true,
}: UseRevealActiveFileOptions) {
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const tree = useFilesStore((s) => s.tree);
  const expandedPaths = useFilesStore((s) => s.expandedPaths);
  const expandDirectory = useFilesStore((s) => s.expandDirectory);
  const projectContext = useIdeStore((s) => s.projectContext);

  const debounceTimeoutRef = useRef<number | null>(null);
  const prevActivePathRef = useRef<string | null>(null);

  // Main reveal logic
  const revealFile = useCallback(
    async (filePath: string) => {
      if (!projectContext || !containerRef.current) return;

      const projectPath = projectContext.projectPath;

      // Check if file or any ancestor is gitignored
      if (isPathOrAncestorGitignored(tree, filePath, projectPath)) {
        return;
      }

      // Find the DOM element for this file
      const fileElement = containerRef.current.querySelector(
        `[data-file-path="${CSS.escape(filePath)}"]`
      ) as HTMLElement | null;

      // If element exists, check visibility
      if (fileElement) {
        const isVisible = await checkElementVisibility(
          fileElement,
          containerRef.current
        );
        if (isVisible) {
          return;
        }
      }

      // Need to reveal - expand all parent directories first
      const parentPaths = getParentPaths(filePath, projectPath);

      for (const parentPath of parentPaths) {
        if (!expandedPaths.has(parentPath)) {
          await expandDirectory(parentPath, projectPath);
        }
      }

      // After expanding, scroll the file into view
      // Use requestAnimationFrame to wait for DOM updates
      requestAnimationFrame(() => {
        const element = containerRef.current?.querySelector(
          `[data-file-path="${CSS.escape(filePath)}"]`
        ) as HTMLElement | null;

        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
    },
    [tree, expandedPaths, expandDirectory, projectContext, containerRef]
  );

  // Debounced reveal trigger
  useEffect(() => {
    if (
      !enabled ||
      !activeTabPath ||
      activeTabPath === prevActivePathRef.current
    ) {
      return;
    }

    prevActivePathRef.current = activeTabPath;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the reveal
    debounceTimeoutRef.current = window.setTimeout(() => {
      revealFile(activeTabPath);
    }, REVEAL_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [enabled, activeTabPath, revealFile]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
}
