/**
 * Resizable Sidebar Container
 *
 * Renders the appropriate panel based on active selection.
 * Styled with glass effects and theme support to match Panager's design.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { FileTreePanel } from "../panels/FileTreePanel";
import { GitPanel } from "../panels/GitPanel";
import { SearchPanel } from "../panels/SearchPanel";
import { SettingsPanel } from "../panels/SettingsPanel";
import { cn } from "../../../lib/utils";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

export function Sidebar() {
  const activePanel = useIdeStore((s) => s.activePanel);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 48; // 48px is activity bar width
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex shrink-0 relative",
        useLiquidGlass
          ? "liquid-glass-sidebar"
          : [
              isDark ? "bg-neutral-900/95" : "bg-white/95",
              "border-r border-black/5 dark:border-white/5",
            ]
      )}
      style={{ width: sidebarWidth }}
    >
      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activePanel === "files" && <FileTreePanel />}
        {activePanel === "git" && <GitPanel />}
        {activePanel === "search" && <SearchPanel />}
        {activePanel === "settings" && <SettingsPanel />}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors",
          isResizing
            ? "bg-primary/50"
            : "hover:bg-primary/30"
        )}
      />
    </div>
  );
}
