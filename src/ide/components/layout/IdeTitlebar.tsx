/**
 * IDE Titlebar - Panager-styled titlebar with Quick Open search
 *
 * Provides drag region for window movement, space for macOS traffic lights,
 * and a search bar that opens the Quick Open dialog (Cmd+P).
 */

import { Search } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";

export function IdeTitlebar() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  const handleSearchClick = () => {
    setShowQuickOpen(true);
  };

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "titlebar titlebar-compact flex items-center gap-2 px-3 select-none shrink-0",
        useLiquidGlass
          ? "liquid-glass-titlebar"
          : "bg-vibrancy-sidebar"
      )}
    >
      {/* Traffic light spacer - macOS window controls appear here */}
      <div className="w-[70px] shrink-0" data-tauri-drag-region />

      {/* Center - Search bar (opens Quick Open on click) */}
      <div className="flex-1 flex justify-center" data-tauri-drag-region>
        <button
          onClick={handleSearchClick}
          className={cn(
            "relative flex items-center w-full max-w-[480px] h-8 px-3 gap-2",
            "text-[13px] text-left",
            "rounded-lg transition-all",
            useLiquidGlass
              ? "liquid-glass-input"
              : [
                  isDark
                    ? "bg-white/[0.06] hover:bg-white/[0.08]"
                    : "bg-black/[0.04] hover:bg-black/[0.06]",
                ]
          )}
        >
          <Search
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          />
          <span
            className={cn(
              "flex-1 truncate",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            {projectContext?.projectName ?? "Search files..."}
          </span>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
              isDark
                ? "bg-white/[0.08] text-neutral-500"
                : "bg-black/[0.06] text-neutral-400"
            )}
          >
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}P
          </kbd>
        </button>
      </div>

      {/* Right spacer for balance */}
      <div className="w-[70px] shrink-0" data-tauri-drag-region />
    </div>
  );
}
