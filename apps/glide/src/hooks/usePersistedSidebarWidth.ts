/**
 * Persisted Sidebar Width Hook
 *
 * Saves and restores sidebar width to localStorage per project.
 */

import { useEffect, useRef } from "react";
import { useIdeStore } from "../stores/ide";

const STORAGE_KEY_PREFIX = "ide-sidebar-width-";
const DEBOUNCE_MS = 500;

export function usePersistedSidebarWidth() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  const storageKey = projectContext
    ? `${STORAGE_KEY_PREFIX}${projectContext.projectId}`
    : null;

  // Restore on mount
  useEffect(() => {
    if (!storageKey || hasRestoredRef.current) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const width = parseInt(saved, 10);
        if (!isNaN(width) && width > 0) {
          setSidebarWidth(width);
        }
      }
    } catch {
      // Ignore errors
    }

    hasRestoredRef.current = true;
  }, [storageKey, setSidebarWidth]);

  // Debounced save
  useEffect(() => {
    if (!storageKey || !hasRestoredRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, String(sidebarWidth));
      } catch {
        // Ignore errors
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [storageKey, sidebarWidth]);
}
