/**
 * Right Sidebar Container
 *
 * Renders the Chat or Tasks panel based on active selection.
 * Styled with glass effects and theme support to match Panager's design.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import { ChatPanel } from "../agent/ChatPanel";
import { TasksPanel } from "../agent/TasksPanel";

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

export function RightSidebar() {
  const rightSidebarPanel = useIdeStore((s) => s.rightSidebarPanel);
  const rightSidebarWidth = useIdeStore((s) => s.rightSidebarWidth);
  const setRightSidebarWidth = useIdeStore((s) => s.setRightSidebarWidth);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Activity bar width for offset calculations
  const activityBarWidth = 48;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // For right sidebar, calculate from right edge
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX - activityBarWidth;
      setRightSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
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
  }, [isResizing, setRightSidebarWidth]);

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex shrink-0 relative",
        useLiquidGlass
          ? "liquid-glass-sidebar"
          : [
              isDark ? "bg-neutral-900/95" : "bg-white/95",
              "border-l border-black/5 dark:border-white/5",
            ]
      )}
      style={{ width: rightSidebarWidth }}
    >
      {/* Resize handle on left edge */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10",
          isResizing ? "bg-primary/50" : "hover:bg-primary/30"
        )}
      />

      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {rightSidebarPanel === "chat" && <ChatPanel />}
        {rightSidebarPanel === "tasks" && <TasksPanel />}
      </div>
    </div>
  );
}
