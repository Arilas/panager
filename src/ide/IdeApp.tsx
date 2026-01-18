/**
 * IDE Application Root Component
 *
 * Wraps the IDE layout with settings provider for theme and liquid glass support.
 */

import { useEffect, useState } from "react";
import { useIdeStore } from "./stores/ide";
import { useFilesStore } from "./stores/files";
import { useGitStore } from "./stores/git";
import { IdeSettingsProvider } from "./contexts/IdeSettingsContext";
import { IdeLayout } from "./components/layout/IdeLayout";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { usePersistedIdeState } from "./hooks/usePersistedIdeState";
import type { IdeProjectContext } from "./types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { stopWatcher } from "./lib/tauri-ide";
import { getProject, getScopes } from "../lib/tauri";

export function IdeApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeColor, setScopeColor] = useState<string>("#6b7280");

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

  // Fetch project's scope color and set CSS variable
  useEffect(() => {
    if (!projectContext) return;

    const fetchScopeColor = async () => {
      try {
        const project = await getProject(projectContext.projectId);
        const scopes = await getScopes();
        const scope = scopes.find((s) => s.scope.id === project.project.scopeId);
        if (scope?.scope.color) {
          setScopeColor(scope.scope.color);
        }
      } catch (err) {
        console.error("[IDE] Failed to fetch scope color:", err);
      }
    };

    fetchScopeColor();
  }, [projectContext]);

  // Set scope color CSS variable on document body
  useEffect(() => {
    document.body.style.setProperty("--scope-color", scopeColor);
  }, [scopeColor]);

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

  // Listen for liquid-glass-ready event from Tauri backend
  // This event is emitted after _setUseSystemAppearance is enabled,
  // which is needed for the CSS @supports (-apple-visual-effect) query to work.
  // We force a stylesheet reload to re-evaluate @supports queries.
  useEffect(() => {
    const currentWindow = getCurrentWindow();

    // Use window-specific listener to ensure we capture events for this window
    const unlistenPromise = currentWindow.listen("liquid-glass-ready", () => {
      console.log("[IDE] Received liquid-glass-ready event, reloading stylesheets...");
      // Force CSS re-evaluation by cloning and replacing all stylesheets
      // This makes the browser re-parse the CSS and re-evaluate @supports queries
      const styleSheets = document.querySelectorAll(
        'link[rel="stylesheet"], style'
      );
      console.log(`[IDE] Found ${styleSheets.length} stylesheets to reload`);
      styleSheets.forEach((sheet) => {
        const clone = sheet.cloneNode(true) as HTMLElement;
        sheet.parentNode?.insertBefore(clone, sheet.nextSibling);
        sheet.remove();
      });
      console.log("[IDE] Stylesheet reload complete");
    });

    console.log("[IDE] Registered liquid-glass-ready listener");

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

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-red-500 dark:text-red-400">
        <div className="text-center">
          <p className="text-lg font-medium">Failed to load IDE</p>
          <p className="text-sm text-neutral-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!projectContext) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
        <p>No project context</p>
      </div>
    );
  }

  return (
    <IdeSettingsProvider>
      <IdeLayout />
    </IdeSettingsProvider>
  );
}
