/**
 * IDE Application Root Component
 */

import { useEffect, useState } from "react";
import { useIdeStore } from "./stores/ide";
import { useFilesStore } from "./stores/files";
import { useGitStore } from "./stores/git";
import { IdeLayout } from "./components/layout/IdeLayout";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { usePersistedIdeState } from "./hooks/usePersistedIdeState";
import type { IdeProjectContext } from "./types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { stopWatcher } from "./lib/tauri-ide";

export function IdeApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setProjectContext = useIdeStore((s) => s.setProjectContext);
  const projectContext = useIdeStore((s) => s.projectContext);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);
  const loadGitStatus = useGitStore((s) => s.loadGitStatus);

  // Parse URL parameters and initialize
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");
    const projectPath = params.get("projectPath");
    const projectName = params.get("projectName");

    if (!projectId || !projectPath || !projectName) {
      setError("Missing project information in URL");
      setLoading(false);
      return;
    }

    const context: IdeProjectContext = {
      projectId,
      projectPath: decodeURIComponent(projectPath),
      projectName: decodeURIComponent(projectName),
    };

    setProjectContext(context);
    setLoading(false);
  }, [setProjectContext]);

  // Load file tree and git status when context is set
  useEffect(() => {
    if (!projectContext) return;

    loadFileTree(projectContext.projectPath);
    loadGitStatus(projectContext.projectPath).catch(console.error);
  }, [projectContext, loadFileTree, loadGitStatus]);

  // Set up file watcher
  useFileWatcher();

  // Set up state persistence
  usePersistedIdeState();

  // Handle window close - cleanup watcher
  useEffect(() => {
    if (!projectContext) return;

    const currentWindow = getCurrentWindow();

    const handleClose = async () => {
      await stopWatcher(`ide-${projectContext.projectId}`);
    };

    currentWindow.onCloseRequested(handleClose);
  }, [projectContext]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-900 text-neutral-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-900 text-red-400">
        <div className="text-center">
          <p className="text-lg font-medium">Failed to load IDE</p>
          <p className="text-sm text-neutral-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!projectContext) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-900 text-neutral-400">
        <p>No project context</p>
      </div>
    );
  }

  return <IdeLayout />;
}
