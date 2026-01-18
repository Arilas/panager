/**
 * File Watcher Hook
 *
 * Listens for file system events and updates the file tree accordingly.
 */

import { useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";
import { startWatcher, stopWatcher } from "../lib/tauri-ide";
import type { IdeFileEvent } from "../types";

const WINDOW_LABEL_PREFIX = "ide-";

export function useFileWatcher() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);
  const addFileToTree = useFilesStore((s) => s.addFileToTree);
  const removeFileFromTree = useFilesStore((s) => s.removeFileFromTree);

  // Get window label from project ID
  const windowLabel = projectContext
    ? `${WINDOW_LABEL_PREFIX}${projectContext.projectId}`
    : null;

  // Handle file system events
  const handleFileEvent = useCallback(
    (event: IdeFileEvent) => {
      if (!projectContext) return;

      switch (event.type) {
        case "created":
          // Determine if it's a directory by checking for extension
          const isDirectory = !event.path.includes(".");
          addFileToTree(event.path, isDirectory);
          // Refresh the tree to get updated content
          loadFileTree(projectContext.projectPath);
          break;

        case "deleted":
          removeFileFromTree(event.path);
          // Refresh the tree
          loadFileTree(projectContext.projectPath);
          break;

        case "modified":
          // For modified files, we might want to update content if open
          // For now, just refresh the tree
          break;

        case "renamed":
          removeFileFromTree(event.oldPath);
          const isRenamedDirectory = !event.newPath.includes(".");
          addFileToTree(event.newPath, isRenamedDirectory);
          loadFileTree(projectContext.projectPath);
          break;
      }
    },
    [projectContext, loadFileTree, addFileToTree, removeFileFromTree]
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
    };
  }, [projectContext, windowLabel, handleFileEvent]);
}
