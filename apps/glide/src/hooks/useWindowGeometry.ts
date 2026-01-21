/**
 * Hook to track and persist window geometry (position, size)
 *
 * Listens for window move/resize events and saves the geometry
 * to the session storage with debouncing to avoid excessive writes.
 */

import { useEffect, useRef, useCallback } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import {
  saveWindowState,
  updateWindowGeometry,
  removeWindowState,
  type WindowGeometry,
} from "../lib/tauri-ide";
import type { IdeProjectContext } from "../types";

const DEBOUNCE_MS = 500;

export function useWindowGeometry(projectContext: IdeProjectContext | null) {
  const windowRef = useRef<Window | null>(null);
  const windowLabelRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSaveRef = useRef(false);

  // Get current window geometry
  const getGeometry = useCallback(async (): Promise<WindowGeometry | null> => {
    const window = windowRef.current;
    if (!window) return null;

    try {
      const [position, size, isMaximized] = await Promise.all([
        window.outerPosition(),
        window.outerSize(),
        window.isMaximized(),
      ]);

      return {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        isMaximized,
      };
    } catch (e) {
      console.error("Failed to get window geometry:", e);
      return null;
    }
  }, []);

  // Save geometry with debouncing
  const saveGeometryDebounced = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const windowLabel = windowLabelRef.current;
      if (!windowLabel) return;

      const geometry = await getGeometry();
      if (!geometry) return;

      try {
        await updateWindowGeometry(windowLabel, geometry);
      } catch (e) {
        console.error("Failed to update window geometry:", e);
      }
    }, DEBOUNCE_MS);
  }, [getGeometry]);

  // Initialize window tracking
  useEffect(() => {
    const window = getCurrentWindow();
    windowRef.current = window;
    windowLabelRef.current = window.label;

    // Save initial state when project is loaded
    const saveInitialState = async () => {
      if (!projectContext || initialSaveRef.current) return;

      const geometry = await getGeometry();
      if (!geometry) return;

      try {
        await saveWindowState(
          window.label,
          projectContext.projectId,
          projectContext.projectPath,
          projectContext.projectName,
          geometry
        );
        initialSaveRef.current = true;
        console.log(`[Session] Saved window state for ${projectContext.projectName}`);
      } catch (e) {
        console.error("Failed to save initial window state:", e);
      }
    };

    saveInitialState();
  }, [projectContext, getGeometry]);

  // Set up event listeners for move/resize
  useEffect(() => {
    if (!projectContext) return;

    const window = windowRef.current;
    if (!window) return;

    const unlistenPromises: Promise<() => void>[] = [];

    // Listen for move events
    unlistenPromises.push(
      window.onMoved(() => {
        saveGeometryDebounced();
      })
    );

    // Listen for resize events
    unlistenPromises.push(
      window.onResized(() => {
        saveGeometryDebounced();
      })
    );

    return () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Unsubscribe from events
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
      });
    };
  }, [projectContext, saveGeometryDebounced]);

  /**
   * Call this before closing the window to:
   * 1. Cancel any pending debounced geometry saves
   * 2. Remove the window state from the session
   */
  const cleanupAndRemove = useCallback(async () => {
    // Cancel pending debounced save to prevent race condition
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const label = windowLabelRef.current;
    console.log(`[Session] Cleaning up and removing window: ${label}`);
    if (label) {
      try {
        await removeWindowState(label);
        console.log(`[Session] Successfully removed window state for: ${label}`);
      } catch (e) {
        console.error("Failed to remove window state:", e);
      }
    }
  }, []);

  // Return the window label and cleanup function for use in close handler
  return {
    windowLabel: windowLabelRef.current,
    cleanupAndRemove,
  };
}
