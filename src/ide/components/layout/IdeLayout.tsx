/**
 * Main IDE Layout Component
 *
 * Structure (with Panager native styling):
 * ┌─────────────────────────────────────────────────────┐
 * │ [Traffic Lights]      Project Name                  │  <- IdeTitlebar (drag region)
 * ├─────────────────────────────────────────────────────┤
 * │ ActivityBar │ Sidebar (resizable) │ Content Area    │
 * │             │                     │                 │
 * │  [Files]    │ FileTree / Git /    │ EditorTabs      │
 * │  [Git]      │ Search panels       │ MonacoEditor    │
 * │  [Search]   │                     │                 │
 * │             │                     │                 │
 * │  [Problems] ├─────────────────────┴─────────────────┤
 * │  [Settings] │ Bottom Panel (Problems/Output/Term)   │
 * ├─────────────┴───────────────────────────────────────┤
 * │ StatusBar                                           │
 * └─────────────────────────────────────────────────────┘
 */

import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { useGeneralSettings } from "../../stores/settings";
import { IdeTitlebar } from "./IdeTitlebar";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { ContentArea } from "./ContentArea";
import { BottomPanel } from "./BottomPanel";
import { StatusBar } from "./StatusBar";
import { QuickOpenDialog } from "../dialogs/QuickOpenDialog";
import { GoToLineDialog } from "../dialogs/GoToLineDialog";
import { IdeSettingsDialog } from "../settings/IdeSettingsDialog";
import { useIdeKeyboard } from "../../hooks/useIdeKeyboard";
import { usePluginEvents } from "../../hooks/usePluginEvents";
import { cn } from "../../../lib/utils";

export function IdeLayout() {
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const activePanel = useIdeStore((s) => s.activePanel);
  const showSettingsDialog = useIdeStore((s) => s.showSettingsDialog);
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);
  const { useLiquidGlass, effectiveTheme, loading } = useIdeSettingsContext();

  // Layout settings from IDE settings store
  const generalSettings = useGeneralSettings();
  const activityBarPosition = generalSettings.activityBar.position;
  const isActivityBarHidden = activityBarPosition === "hidden";
  const isActivityBarRight = activityBarPosition === "right";
  // Sidebar follows activity bar position
  const isSidebarRight = isActivityBarRight;

  // Set up keyboard shortcuts
  useIdeKeyboard();

  // Listen for plugin events from backend
  usePluginEvents();

  const isDark = effectiveTheme === "dark";

  // Show loading state while settings are loading
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-500 dark:border-t-neutral-400 rounded-full animate-spin" />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-screen w-screen flex flex-col overflow-hidden",
        useLiquidGlass
          ? "liquid-glass"
          : isDark
            ? "bg-neutral-900"
            : "bg-neutral-50",
        isDark ? "text-neutral-100" : "text-neutral-900"
      )}
    >
      {/* Titlebar with traffic light spacer */}
      <IdeTitlebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex min-h-0">
          {/* Activity Bar - Left position */}
          {!isActivityBarHidden && !isActivityBarRight && (
            <ActivityBar position="left" />
          )}

          {/* Sidebar - Left position */}
          {!isSidebarRight && activePanel && !sidebarCollapsed && (
            <Sidebar position="left" />
          )}

          {/* Content Area */}
          <ContentArea />

          {/* Sidebar - Right position */}
          {isSidebarRight && activePanel && !sidebarCollapsed && (
            <Sidebar position="right" />
          )}

          {/* Activity Bar - Right position */}
          {!isActivityBarHidden && isActivityBarRight && (
            <ActivityBar position="right" />
          )}
        </div>

        {/* Bottom Panel */}
        <BottomPanel />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <QuickOpenDialog />
      <GoToLineDialog />
      <IdeSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </div>
  );
}
