/**
 * Glide Application Root Component
 *
 * Wraps the editor layout with settings provider for theme and liquid glass support.
 * Shows a welcome screen when no project is opened.
 */

import { useEffect, useState } from "react";
import { useIdeStore } from "./stores/ide";
import { useFilesStore } from "./stores/files";
import { useGitStore } from "./stores/git";
import { useIdeSettingsStore } from "./stores/settings";
import { IdeSettingsProvider } from "./contexts/IdeSettingsContext";
import { IdeLayout } from "./components/layout/IdeLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { usePersistedIdeState } from "./hooks/usePersistedIdeState";
import type { IdeProjectContext } from "./types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { stopWatcher, notifyProjectOpened, notifyProjectClosed, addRecentProject } from "./lib/tauri-ide";

export function GlideApp() {
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const setProjectContext = useIdeStore((s) => s.setProjectContext);
  const projectContext = useIdeStore((s) => s.projectContext);
  const loadFileTree = useFilesStore((s) => s.loadFileTree);
  const loadGitStatus = useGitStore((s) => s.loadGitStatus);
  const initializeSettings = useIdeSettingsStore((s) => s.initialize);

  // Parse URL parameters and initialize
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");
    const projectPath = params.get("projectPath");
    const projectName = params.get("projectName");

    if (!projectId || !projectPath || !projectName) {
      // No project provided - show welcome screen
      setShowWelcome(true);
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

  // Handle project selection from welcome screen
  const handleProjectSelected = (projectId: string, projectPath: string, projectName: string) => {
    const context: IdeProjectContext = {
      projectId,
      projectPath,
      projectName,
    };

    setProjectContext(context);
    setShowWelcome(false);

    // Update window title
    getCurrentWindow().setTitle(projectName).catch(console.error);
  };

  // Load file tree, git status, and notify plugins when context is set
  useEffect(() => {
    if (!projectContext) return;

    loadFileTree(projectContext.projectPath);
    loadGitStatus(projectContext.projectPath).catch(console.error);

    // Notify plugins about project being opened (starts LSP servers, etc.)
    notifyProjectOpened(projectContext.projectPath).catch(console.error);

    // Track this project in recent projects
    addRecentProject(
      projectContext.projectId,
      projectContext.projectName,
      projectContext.projectPath
    ).catch(console.error);
  }, [projectContext, loadFileTree, loadGitStatus]);

  // Initialize settings when project context is set
  useEffect(() => {
    if (!projectContext) return;

    // Initialize settings with project context (no scope folder in Glide)
    initializeSettings(projectContext.projectPath, null);
  }, [projectContext, initializeSettings]);

  // Set up file watcher (only when project is open)
  useFileWatcher();

  // Set up state persistence (only when project is open)
  usePersistedIdeState();

  // Handle window close - cleanup watcher and notify plugins
  useEffect(() => {
    if (!projectContext) return;

    const currentWindow = getCurrentWindow();

    const handleClose = async () => {
      // Notify plugins about project being closed (stops LSP servers, etc.)
      await notifyProjectClosed().catch(console.error);
      await stopWatcher(`ide-${projectContext.projectId}`);
    };

    currentWindow.onCloseRequested(handleClose);
  }, [projectContext]);

  // Listen for liquid-glass-ready event from Tauri backend
  useEffect(() => {
    const currentWindow = getCurrentWindow();

    const unlistenPromise = currentWindow.listen("liquid-glass-ready", () => {
      console.log("[Glide] Received liquid-glass-ready event, reloading stylesheets...");
      const styleSheets = document.querySelectorAll(
        'link[rel="stylesheet"], style'
      );
      console.log(`[Glide] Found ${styleSheets.length} stylesheets to reload`);
      styleSheets.forEach((sheet) => {
        const clone = sheet.cloneNode(true) as HTMLElement;
        sheet.parentNode?.insertBefore(clone, sheet.nextSibling);
        sheet.remove();
      });
      console.log("[Glide] Stylesheet reload complete");
    });

    console.log("[Glide] Registered liquid-glass-ready listener");

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-500 dark:border-t-neutral-400 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Show welcome screen if no project
  if (showWelcome || !projectContext) {
    return <WelcomeScreen onProjectSelected={handleProjectSelected} />;
  }

  return (
    <IdeSettingsProvider>
      <IdeLayout />
    </IdeSettingsProvider>
  );
}
