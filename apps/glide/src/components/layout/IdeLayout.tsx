/**
 * Main IDE Layout Component
 *
 * Structure (with Panager native styling):
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ [Traffic Lights]      Project Name                                       │  <- IdeTitlebar (drag region)
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ ActivityBar │ Sidebar (resizable) │ Content Area     │ R.Sidebar │ R.AB │
 * │             │                     │                  │ (Chat)    │      │
 * │  [Files]    │ FileTree / Git /    │ EditorTabs       │           │ [💬] │
 * │  [Git]      │ Search panels       │ MonacoEditor     │           │ [📋] │
 * │  [Search]   │                     │                  │           │      │
 * │             │                     │                  │           │      │
 * │  [Problems] ├─────────────────────┴──────────────────┴───────────┴──────┤
 * │  [Settings] │ Bottom Panel (Problems/Output/Term)                       │
 * ├─────────────┴───────────────────────────────────────────────────────────┤
 * │ StatusBar                                                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { useIdeStore } from "../../stores/ide";
import {
  useEffectiveTheme,
  useLiquidGlass,
} from "../../hooks/useEffectiveTheme";
import { useGeneralSettings } from "../../stores/settings";
import { IdeTitlebar } from "./IdeTitlebar";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { ContentArea } from "./ContentArea";
import { BottomPanel } from "./BottomPanel";
import { StatusBar } from "./StatusBar";
import { RightSidebar } from "./RightSidebar";
import { RightActivityBar } from "./RightActivityBar";
import { QuickOpenDialog } from "../dialogs/QuickOpenDialog";
import { GoToLineDialog } from "../dialogs/GoToLineDialog";
import { GoToSymbolDialog } from "../dialogs/GoToSymbolDialog";
import { IdeSettingsDialog } from "../settings/IdeSettingsDialog";
import { useIdeKeyboard } from "../../hooks/useIdeKeyboard";
import { usePluginEvents } from "../../hooks/usePluginEvents";
import { cn } from "../../lib/utils";

export function IdeLayout() {
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const activePanel = useIdeStore((s) => s.activePanel);
  const showQuickOpen = useIdeStore((s) => s.showQuickOpen);
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const showGoToLine = useIdeStore((s) => s.showGoToLine);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const showGoToSymbol = useIdeStore((s) => s.showGoToSymbol);
  const setShowGoToSymbol = useIdeStore((s) => s.setShowGoToSymbol);
  const showSettingsDialog = useIdeStore((s) => s.showSettingsDialog);
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);
  const rightSidebarPanel = useIdeStore((s) => s.rightSidebarPanel);
  const rightSidebarCollapsed = useIdeStore((s) => s.rightSidebarCollapsed);
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

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

  return (
    <div
      className={cn(
        "h-screen w-screen flex flex-col overflow-hidden",
        isDark ? "bg-neutral-900/60" : "bg-white/60",
        liquidGlass && "liquid-glass",
        isDark ? "text-neutral-100" : "text-neutral-900",
      )}
    >
      {/* Titlebar with traffic light spacer */}
      <IdeTitlebar />

      {/* Main content area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0",
          liquidGlass && "px-2 pb-2 gap-2",
        )}
      >
        <div className={cn("flex-1 flex min-h-0", liquidGlass && "gap-2")}>
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

          {/* Activity Bar - Right position (left side, before right sidebar) */}
          {!isActivityBarHidden && isActivityBarRight && (
            <ActivityBar position="right" />
          )}

          {/* Right Sidebar (Chat/Tasks panel) */}
          {rightSidebarPanel && !rightSidebarCollapsed && <RightSidebar />}

          {/* Right Activity Bar (Chat/Tasks icons) */}
          <RightActivityBar />
        </div>

        {/* Bottom Panel */}
        <BottomPanel />

        {/* Status Bar - inside padded container when liquid glass */}
        {liquidGlass && <StatusBar />}
      </div>

      {/* Status Bar - outside when not liquid glass */}
      {!liquidGlass && <StatusBar />}

      {/* Dialogs */}
      <QuickOpenDialog open={showQuickOpen} onOpenChange={setShowQuickOpen} />
      <GoToLineDialog open={showGoToLine} onOpenChange={setShowGoToLine} />
      <GoToSymbolDialog open={showGoToSymbol} onOpenChange={setShowGoToSymbol} />
      <IdeSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </div>
  );
}
