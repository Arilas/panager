/**
 * Resizable Sidebar Container
 *
 * Renders the appropriate panel based on active selection.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useIdeStore } from "../../stores/ide";
import { FileTreePanel } from "../panels/FileTreePanel";
import { GitPanel } from "../panels/GitPanel";
import { SearchPanel } from "../panels/SearchPanel";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

export function Sidebar() {
  const activePanel = useIdeStore((s) => s.activePanel);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);

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
      className="flex bg-neutral-900 border-r border-neutral-800 shrink-0 relative"
      style={{ width: sidebarWidth }}
    >
      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activePanel === "files" && <FileTreePanel />}
        {activePanel === "git" && <GitPanel />}
        {activePanel === "search" && <SearchPanel />}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors ${
          isResizing ? "bg-blue-500/50" : ""
        }`}
      />
    </div>
  );
}
