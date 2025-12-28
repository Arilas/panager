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

  // Set scope color CSS variable
  const scopeColor = currentScope?.scope.color || "#6b7280";

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
    const unlistenAbout = listen("menu-about", () => {
      setShowAbout(true);
    });
    const unlistenSettings = listen("menu-settings", () => {
      setShowSettings(true);
    });
    const unlistenSidebar = listen("menu-toggle-sidebar", () => {
      toggleRightPanel();
    });

    return () => {
      unlistenAbout.then((unlisten) => unlisten());
      unlistenSettings.then((unlisten) => unlisten());
      unlistenSidebar.then((unlisten) => unlisten());
    };
  }, [toggleRightPanel]);

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
