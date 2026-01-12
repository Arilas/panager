import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { Titlebar } from "./components/layout/Titlebar";
import { Dashboard } from "./pages/Dashboard";
import { NewScopeDialog } from "./components/scopes/NewScopeDialog";
import { CommandPalette } from "./components/ui/CommandPalette";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { AboutDialog } from "./components/settings/AboutDialog";
import { useSettingsStore } from "./stores/settings";
import { useEditorsStore } from "./stores/editors";
import { useScopesStore } from "./stores/scopes";
import { useUIStore } from "./stores/ui";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";
import { setupAppEventListener } from "./stores/events";

function App() {
  const { fetchSettings } = useSettingsStore();
  const { fetchEditors } = useEditorsStore();
  const { getCurrentScope } = useScopesStore();
  const { toggleRightPanel } = useUIStore();
  const currentScope = getCurrentScope();
  const [showNewScope, setShowNewScope] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Register global shortcut (Cmd+Shift+O)
  useGlobalShortcut();

  useEffect(() => {
    fetchSettings();
    fetchEditors();
  }, [fetchSettings, fetchEditors]);

  // Set up centralized app event listener
  useEffect(() => {
    const unlistenPromise = setupAppEventListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Set scope color CSS variable on document body so dialogs (portals) can access it
  const scopeColor = currentScope?.scope.color || "#6b7280";

  useEffect(() => {
    document.body.style.setProperty("--scope-color", scopeColor);
  }, [scopeColor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K - Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      // Cmd+B / Ctrl+B - Toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleRightPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleRightPanel]);

  // Listen for menu bar events from Tauri
  useEffect(() => {
    const listeners = [
      listen("menu-about", () => setShowAbout(true)),
      listen("menu-settings", () => setShowSettings(true)),
      listen("menu-toggle-sidebar", () => toggleRightPanel()),
    ];

    return () => {
      listeners.forEach((promise) => promise.then((unlisten) => unlisten()));
    };
  }, [toggleRightPanel]);

  // Listen for liquid-glass-ready event from Tauri backend
  // This event is emitted after _setUseSystemAppearance is enabled,
  // which is needed for the CSS @supports (-apple-visual-effect) query to work.
  // We force a stylesheet reload to re-evaluate @supports queries.
  useEffect(() => {
    const unlistenPromise = listen("liquid-glass-ready", () => {
      // Force CSS re-evaluation by cloning and replacing all stylesheets
      // This makes the browser re-parse the CSS and re-evaluate @supports queries
      const styleSheets = document.querySelectorAll(
        'link[rel="stylesheet"], style'
      );
      styleSheets.forEach((sheet) => {
        const clone = sheet.cloneNode(true) as HTMLElement;
        sheet.parentNode?.insertBefore(clone, sheet.nextSibling);
        sheet.remove();
      });
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleOpenCommandPalette = useCallback(() => {
    setShowCommandPalette(true);
  }, []);

  const handleNewScopeClick = useCallback(() => {
    setShowNewScope(true);
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ "--scope-color": scopeColor } as React.CSSProperties}
    >
      <Titlebar onOpenCommandPalette={handleOpenCommandPalette} onSettingsClick={handleSettingsClick} />
      <Dashboard onNewScopeClick={handleNewScopeClick} />

      <NewScopeDialog open={showNewScope} onOpenChange={setShowNewScope} />
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        onNewScopeClick={() => setShowNewScope(true)}
        onSettingsClick={handleSettingsClick}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
    </div>
  );
}

export default App;
