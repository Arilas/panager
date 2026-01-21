/**
 * IDE Titlebar - Panager-styled titlebar with Quick Open search
 *
 * Provides drag region for window movement, space for macOS traffic lights,
 * a search bar that opens the Quick Open dialog (Cmd+P), history navigation,
 * panel toggle controls, and settings button.
 */

import {
  Search,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Settings,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useEditorStore } from "../../stores/editor";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

export function IdeTitlebar() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useIdeStore((s) => s.toggleSidebar);
  const rightSidebarCollapsed = useIdeStore((s) => s.rightSidebarCollapsed);
  const toggleRightSidebar = useIdeStore((s) => s.toggleRightSidebar);
  const bottomPanelOpen = useIdeStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useIdeStore((s) => s.toggleBottomPanel);
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);

  // History navigation from editor store
  const navigateBack = useEditorStore((s) => s.navigateBack);
  const navigateForward = useEditorStore((s) => s.navigateForward);
  const canGoBack = useEditorStore((s) => s.canNavigateBack());
  const canGoForward = useEditorStore((s) => s.canNavigateForward());

  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  const isDark = effectiveTheme === "dark";

  const handleSearchClick = () => {
    setShowQuickOpen(true);
  };

  // Common button styles
  const iconButtonClass = cn(
    "flex items-center justify-center w-7 h-7 rounded-md",
    "transition-colors",
    isDark
      ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/10"
      : "text-neutral-500 hover:text-neutral-700 hover:bg-black/10"
  );

  const activeIconButtonClass = cn(
    "flex items-center justify-center w-7 h-7 rounded-md",
    "transition-colors",
    isDark
      ? "text-neutral-200 bg-white/10"
      : "text-neutral-700 bg-black/10"
  );

  const disabledIconButtonClass = cn(
    "flex items-center justify-center w-7 h-7 rounded-md",
    "opacity-30 cursor-not-allowed",
    isDark ? "text-neutral-400" : "text-neutral-500"
  );

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "titlebar titlebar-compact flex items-center gap-2 px-3 select-none shrink-0",
        liquidGlass
          ? "liquid-glass-titlebar"
          : "bg-vibrancy-sidebar"
      )}
    >
      {/* Traffic light spacer - macOS window controls appear here */}
      <div className="w-[70px] shrink-0" data-tauri-drag-region />

      {/* History navigation buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={navigateBack}
          disabled={!canGoBack}
          className={canGoBack ? iconButtonClass : disabledIconButtonClass}
          title="Navigate Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={navigateForward}
          disabled={!canGoForward}
          className={canGoForward ? iconButtonClass : disabledIconButtonClass}
          title="Navigate Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center - Search bar (opens Quick Open on click) */}
      <div className="flex-1 flex justify-center" data-tauri-drag-region>
        <button
          onClick={handleSearchClick}
          className={cn(
            "relative flex items-center w-full max-w-[480px] h-8 px-3 gap-2",
            "text-[13px] text-left",
            "rounded-lg transition-all",
            liquidGlass
              ? "liquid-glass-input"
              : [
                  isDark
                    ? "bg-white/6 hover:bg-white/8"
                    : "bg-black/4 hover:bg-black/6",
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
                ? "bg-white/8 text-neutral-500"
                : "bg-black/6 text-neutral-400"
            )}
          >
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}P
          </kbd>
        </button>
      </div>

      {/* Right section - Panel toggles and settings */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Toggle left sidebar */}
        <button
          onClick={toggleSidebar}
          className={sidebarCollapsed ? iconButtonClass : activeIconButtonClass}
          title={`Toggle Sidebar (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}B)`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Toggle bottom panel */}
        <button
          onClick={toggleBottomPanel}
          className={bottomPanelOpen ? activeIconButtonClass : iconButtonClass}
          title={`Toggle Panel (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}J)`}
        >
          <PanelBottom className="w-4 h-4" />
        </button>

        {/* Toggle right sidebar */}
        <button
          onClick={toggleRightSidebar}
          className={rightSidebarCollapsed ? iconButtonClass : activeIconButtonClass}
          title="Toggle Right Sidebar"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div
          className={cn(
            "w-px h-4 mx-1",
            isDark ? "bg-white/10" : "bg-black/10"
          )}
        />

        {/* Settings button */}
        <button
          onClick={() => setShowSettingsDialog(true)}
          className={iconButtonClass}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
