/**
 * Glide IDE Application Root Component
 *
 * This component is the root for project windows only.
 * Welcome windows use WelcomeApp.tsx instead.
 *
 * Requires URL parameters: projectId, projectPath, projectName
 */

import { useEffect, useState } from "react";
import { useIdeStore } from "./stores/ide";
import { useFilesStore } from "./stores/files";
import { useGitStore } from "./stores/git";
import { useIdeSettingsStore } from "./stores/settings";
import {
  IdeSettingsProvider,
  isMacOS26OrHigher,
} from "./contexts/IdeSettingsContext";
import { IdeLayout } from "./components/layout/IdeLayout";
import { MonacoContextMenuProvider } from "./monaco/contextMenu";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { usePersistedIdeState } from "./hooks/usePersistedIdeState";
import { useWindowGeometry } from "./hooks/useWindowGeometry";
import type { IdeProjectContext } from "./types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  stopWatcher,
  notifyProjectOpened,
  notifyProjectClosed,
  addRecentProject,
  windowWillClose,
} from "./lib/tauri-ide";
import { cn } from "./lib/utils";
import { useEffectiveTheme, useLiquidGlass } from "./hooks/useEffectiveTheme";

export function GlideApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";
  const liquidGlass = useLiquidGlass();

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
      // This should not happen - project windows must have URL params
      setError(
        "Missing project parameters. This window should have been opened with a project.",
      );
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
      projectContext.projectPath,
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

  // Set up window geometry tracking for session restore
  const { cleanupAndRemove } = useWindowGeometry(projectContext);

  // Handle window close - cleanup watcher and notify plugins
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const windowLabel = currentWindow.label;

    const unlisten = currentWindow.onCloseRequested(async () => {
      // Cancel pending geometry saves and remove window from session
      await cleanupAndRemove();

      // Notify backend - project window closing should spawn welcome window
      await windowWillClose(windowLabel, true).catch(console.error);

      if (projectContext) {
        // Notify plugins about project being closed (stops LSP servers, etc.)
        await notifyProjectClosed().catch(console.error);
        await stopWatcher(`ide-${projectContext.projectId}`);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectContext, cleanupAndRemove]);

  // Listen for liquid-glass-ready event from Tauri backend
  useEffect(() => {
    const currentWindow = getCurrentWindow();

    const reloadStylesheets = () => {
      console.log(
        "[Glide] Received liquid-glass-ready event, reloading stylesheets...",
      );
      const styleSheets = document.querySelectorAll(
        'link[rel="stylesheet"], style',
      );
      console.log(`[Glide] Found ${styleSheets.length} stylesheets to reload`);
      styleSheets.forEach((sheet) => {
        const clone = sheet.cloneNode(true) as HTMLElement;
        sheet.parentNode?.insertBefore(clone, sheet.nextSibling);
        sheet.remove();
      });
      console.log("[Glide] Stylesheet reload complete");
    };

    const handle = setTimeout(() => {
      if (isMacOS26OrHigher()) {
        reloadStylesheets();
      }
    }, 200);

    const unlistenPromise = currentWindow.listen(
      "liquid-glass-ready",
      reloadStylesheets,
    );

    console.log("[Glide] Registered liquid-glass-ready listener");

    return () => {
      unlistenPromise.then((fn) => fn());
      clearTimeout(handle);
    };
  }, []);

  if (loading) {
    return (
      <div
        className={cn(
          "h-screen w-screen flex items-center justify-center",
          isDark ? "bg-neutral-900/60" : "bg-white/60",
          liquidGlass && "liquid-glass",
          isDark ? "text-neutral-100" : "text-neutral-900",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-500 dark:border-t-neutral-400 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !projectContext) {
    return (
      <div
        className={cn(
          "h-screen w-screen flex items-center justify-center",
          isDark ? "bg-neutral-900/60" : "bg-white/60",
          liquidGlass && "liquid-glass",
          isDark ? "text-neutral-100" : "text-neutral-900",
        )}
      >
        <div className="flex flex-col items-center gap-2 max-w-md text-center px-4">
          <span className="text-sm">
            {error || "Failed to load project context"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <IdeSettingsProvider>
      <MonacoContextMenuProvider>
        <IdeLayout />
      </MonacoContextMenuProvider>
    </IdeSettingsProvider>
  );
}
