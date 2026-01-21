/**
 * IDE Keyboard Shortcuts Hook
 */

import { useEffect } from "react";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";
import { useEditorStore } from "../stores/editor";

export function useIdeKeyboard() {
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);
  const togglePanel = useIdeStore((s) => s.togglePanel);
  const toggleSidebar = useIdeStore((s) => s.toggleSidebar);
  const toggleBottomPanel = useIdeStore((s) => s.toggleBottomPanel);
  const openBottomPanelTab = useIdeStore((s) => s.openBottomPanelTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const saveActiveFile = useFilesStore((s) => s.saveActiveFile);
  const saveAllFiles = useFilesStore((s) => s.saveAllFiles);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Cmd+, - Open Settings
      if (isMod && e.key === ",") {
        e.preventDefault();
        setShowSettingsDialog(true);
        return;
      }

      // Cmd+P - Quick Open
      if (isMod && e.key === "p" && !isShift) {
        e.preventDefault();
        setShowQuickOpen(true);
        return;
      }

      // Cmd+G - Go to Line
      if (isMod && e.key === "g" && !isShift) {
        e.preventDefault();
        setShowGoToLine(true);
        return;
      }

      // Cmd+W - Close current file
      if (isMod && e.key === "w" && !isShift) {
        e.preventDefault();
        if (activeTabPath) {
          closeTab(activeTabPath);
        }
        return;
      }

      // Cmd+Shift+E - Toggle Explorer
      if (isMod && isShift && e.key === "e") {
        e.preventDefault();
        togglePanel("files");
        return;
      }

      // Cmd+Shift+G - Toggle Git
      if (isMod && isShift && e.key === "g") {
        e.preventDefault();
        togglePanel("git");
        return;
      }

      // Cmd+Shift+F - Toggle Search
      if (isMod && isShift && e.key === "f") {
        e.preventDefault();
        togglePanel("search");
        return;
      }

      // Cmd+B - Toggle Sidebar
      if (isMod && e.key === "b" && !isShift) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+S - Save current file
      if (isMod && e.key === "s" && !isShift) {
        e.preventDefault();
        saveActiveFile().catch(console.error);
        return;
      }

      // Cmd+Shift+S - Save all files
      if (isMod && isShift && e.key === "s") {
        e.preventDefault();
        saveAllFiles().catch(console.error);
        return;
      }

      // Cmd+J - Toggle Bottom Panel
      if (isMod && e.key === "j" && !isShift) {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // Cmd+Shift+M - Focus Problems Panel
      if (isMod && isShift && e.key === "m") {
        e.preventDefault();
        openBottomPanelTab("problems");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setShowQuickOpen,
    setShowGoToLine,
    setShowSettingsDialog,
    togglePanel,
    toggleSidebar,
    toggleBottomPanel,
    openBottomPanelTab,
    closeTab,
    activeTabPath,
    saveActiveFile,
    saveAllFiles,
  ]);
}
