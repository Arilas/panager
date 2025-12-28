import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { NewScopeDialog } from "./components/scopes/NewScopeDialog";
import { CommandPalette } from "./components/ui/CommandPalette";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { useSettingsStore } from "./stores/settings";
import { useEditorsStore } from "./stores/editors";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";

function App() {
  const { fetchSettings } = useSettingsStore();
  const { fetchEditors } = useEditorsStore();
  const [showNewScope, setShowNewScope] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Register global shortcut (Cmd+Shift+O)
  useGlobalShortcut();

  useEffect(() => {
    fetchSettings();
    fetchEditors();
  }, [fetchSettings, fetchEditors]);

  // Keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleSearchClick = useCallback(() => {
    setShowCommandPalette(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onSettingsClick={handleSettingsClick}
        onNewScopeClick={() => setShowNewScope(true)}
        onSearchClick={handleSearchClick}
      />
      <Dashboard />

      <NewScopeDialog open={showNewScope} onOpenChange={setShowNewScope} />
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        onNewScopeClick={() => setShowNewScope(true)}
        onSettingsClick={handleSettingsClick}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

export default App;
