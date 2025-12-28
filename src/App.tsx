import { useEffect, useState, useCallback } from "react";
import { Titlebar } from "./components/layout/Titlebar";
import { Dashboard } from "./pages/Dashboard";
import { NewScopeDialog } from "./components/scopes/NewScopeDialog";
import { CommandPalette } from "./components/ui/CommandPalette";
import { SettingsDialog } from "./components/settings/SettingsDialog";
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
    </div>
  );
}

export default App;
