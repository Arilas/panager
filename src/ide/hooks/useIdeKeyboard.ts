/**
 * IDE Keyboard Shortcuts Hook
 */

import { useEffect } from "react";
import { useIdeStore } from "../stores/ide";
import { useFilesStore } from "../stores/files";

export function useIdeKeyboard() {
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const togglePanel = useIdeStore((s) => s.togglePanel);
  const closeFile = useFilesStore((s) => s.closeFile);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

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
        if (activeFilePath) {
          closeFile(activeFilePath);
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setShowQuickOpen,
    setShowGoToLine,
    togglePanel,
    closeFile,
    activeFilePath,
  ]);
}
