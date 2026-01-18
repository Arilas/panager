/**
 * Bottom Panel - Resizable panel for Problems/Output/Terminal
 *
 * Positioned between the main content area and status bar.
 * Resizable via drag handle.
 */

import { useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import { BottomPanelTabs } from "./BottomPanelTabs";
import { ProblemsPanel } from "../panels/ProblemsPanel";

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 500;

export function BottomPanel() {
  const bottomPanelOpen = useIdeStore((s) => s.bottomPanelOpen);
  const bottomPanelTab = useIdeStore((s) => s.bottomPanelTab);
  const bottomPanelHeight = useIdeStore((s) => s.bottomPanelHeight);
  const setBottomPanelHeight = useIdeStore((s) => s.setBottomPanelHeight);
  const setBottomPanelOpen = useIdeStore((s) => s.setBottomPanelOpen);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Handle mouse move for resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return;

      const delta = startY.current - e.clientY;
      const newHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, startHeight.current + delta)
      );
      setBottomPanelHeight(newHeight);
    },
    [setBottomPanelHeight]
  );

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Set up global event listeners for drag
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Start resizing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = bottomPanelHeight;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [bottomPanelHeight]
  );

  if (!bottomPanelOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex flex-col shrink-0",
        useLiquidGlass
          ? "liquid-glass-sidebar"
          : [
              isDark ? "bg-neutral-900/95" : "bg-neutral-50/95",
              "border-t border-black/5 dark:border-white/5",
            ]
      )}
      style={{ height: bottomPanelHeight }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          "h-1 cursor-ns-resize flex items-center justify-center",
          "hover:bg-blue-500/30 transition-colors"
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            "w-8 h-0.5 rounded-full",
            isDark ? "bg-neutral-700" : "bg-neutral-300"
          )}
        />
      </div>

      {/* Header with tabs and controls */}
      <div
        className={cn(
          "flex items-center h-8 px-2 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <BottomPanelTabs />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Panel controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setBottomPanelOpen(false)}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded",
              "transition-colors",
              isDark
                ? "hover:bg-white/10 text-neutral-400"
                : "hover:bg-black/10 text-neutral-500"
            )}
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {bottomPanelTab === "problems" && <ProblemsPanel />}
        {bottomPanelTab === "output" && <OutputPanel />}
        {bottomPanelTab === "terminal" && <TerminalPanel />}
      </div>
    </div>
  );
}

// Placeholder components for Output and Terminal
function OutputPanel() {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex items-center justify-center",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <p className="text-sm">Output panel coming soon</p>
    </div>
  );
}

function TerminalPanel() {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex items-center justify-center",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <p className="text-sm">Terminal panel coming soon</p>
    </div>
  );
}
