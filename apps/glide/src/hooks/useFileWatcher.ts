/**
 * File Watcher Hook
 *
 * Listens for file system events and updates the file tree accordingly.
 */

import { useEffect, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";
import { useTabsStore } from "../stores/tabs";
import { startWatcher, stopWatcher } from "../lib/tauri-ide";
import { buildFileUrl } from "../lib/tabs/url";
import { FILE_WATCHER_DEBOUNCE_MS } from "../lib/constants";
import type { IdeFileEvent } from "../types";

const WINDOW_LABEL_PREFIX = "ide-";

export function useFileWatcher() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const addFileToTree = useFilesStore((s) => s.addFileToTree);
  const removeFileFromTree = useFilesStore((s) => s.removeFileFromTree);

  // Track pending modified events for debouncing
  const pendingModifiedRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Get window label from project ID
  const windowLabel = projectContext
    ? `${WINDOW_LABEL_PREFIX}${projectContext.projectId}`
    : null;

  // Handle file content update for modified files
  const handleFileModified = useCallback(async (path: string) => {
    const tabsStore = useTabsStore.getState();
    const url = buildFileUrl(path);

    // Check if file is open by looking for it in tabs
    const tabInfo = tabsStore.findTabInAnyGroup(url);
    if (!tabInfo) return;

    const { tab } = tabInfo;
    if (!tab.resolved) return;

    // Only reload if not dirty (no unsaved changes)
    if (!tab.isDirty) {
      // Use the tabs store's reloadContent which will re-resolve the tab
      await tabsStore.reloadContent(url);
    }
  }, []);

  // Handle file system events
  const handleFileEvent = useCallback(
    (event: IdeFileEvent) => {
      if (!projectContext) return;

      switch (event.type) {
        case "created": {
          // Determine if it's a directory - check if path has no extension or ends with /
          const lastSegment = event.path.split("/").pop() || "";
          const isDirectory = !lastSegment.includes(".");
          addFileToTree(event.path, isDirectory);
          break;
        }

        case "deleted":
          removeFileFromTree(event.path);
          break;

        case "modified": {
          // Debounce modified events for the same file
          const pending = pendingModifiedRef.current;
          const existingTimeout = pending.get(event.path);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          const timeout = setTimeout(() => {
            pending.delete(event.path);
            handleFileModified(event.path);
          }, FILE_WATCHER_DEBOUNCE_MS);
          pending.set(event.path, timeout);
          break;
        }

        case "renamed":
          removeFileFromTree(event.oldPath);
          const lastSegment = event.newPath.split("/").pop() || "";
          const isRenamedDirectory = !lastSegment.includes(".");
          addFileToTree(event.newPath, isRenamedDirectory);
          break;
      }
    },
    [projectContext, addFileToTree, removeFileFromTree, handleFileModified]
  );

  // Start watcher and listen for events
  useEffect(() => {
    if (!projectContext || !windowLabel) return;

    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      try {
        // Start the file system watcher
        await startWatcher(windowLabel, projectContext.projectPath);

        // Listen for file events
        unlisten = await listen<IdeFileEvent>("ide-file-event", (event) => {
          handleFileEvent(event.payload);
        });
      } catch (error) {
        console.error("Failed to start file watcher:", error);
      }
    };

    setup();

    // Cleanup on unmount
    return () => {
      if (unlisten) {
        unlisten();
      }
      if (windowLabel) {
        stopWatcher(windowLabel).catch(console.error);
      }
      // Clear pending modified timeouts
      for (const timeout of pendingModifiedRef.current.values()) {
        clearTimeout(timeout);
      }
      pendingModifiedRef.current.clear();
    };
  }, [projectContext, windowLabel, handleFileEvent]);
}
