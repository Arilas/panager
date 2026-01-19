/**
 * Activity Bar - Panager-styled icon bar
 *
 * Vertical icon bar on the far left that toggles sidebar panels.
 * Styled with glass effects and theme support to match Panager's design.
 */

import { Files, GitBranch, Search, Settings, AlertCircle } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useProblemsStore } from "../../stores/problems";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { SidebarPanel } from "../../types";

interface ActivityItem {
  id: Exclude<SidebarPanel, null>;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const TOP_ITEMS: ActivityItem[] = [
  { id: "files", icon: Files, label: "Explorer" },
  { id: "git", icon: GitBranch, label: "Source Control" },
  { id: "search", icon: Search, label: "Search" },
];

interface ActivityBarProps {
  position: "left" | "right";
}

export function ActivityBar({ position }: ActivityBarProps) {
  const activePanel = useIdeStore((s) => s.activePanel);
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);
  const togglePanel = useIdeStore((s) => s.togglePanel);
  const bottomPanelOpen = useIdeStore((s) => s.bottomPanelOpen);
  const openBottomPanelTab = useIdeStore((s) => s.openBottomPanelTab);
  const toggleBottomPanel = useIdeStore((s) => s.toggleBottomPanel);
  const getSummary = useProblemsStore((s) => s.getSummary);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const problemsSummary = getSummary();

  const handlePanelClick = (panelId: Exclude<SidebarPanel, null>) => {
    if (sidebarCollapsed) {
      // If sidebar is collapsed, open it with the clicked panel
      setActivePanel(panelId);
      useIdeStore.setState({ sidebarCollapsed: false });
    } else {
      // Otherwise toggle as normal
      togglePanel(panelId);
    }
  };

  const isRight = position === "right";

  return (
    <div
      className={cn(
        "flex flex-col w-12 shrink-0",
        useLiquidGlass
          ? "liquid-glass-sidebar"
          : [
              "bg-vibrancy-sidebar",
              isRight
                ? "border-l border-black/5 dark:border-white/5"
                : "border-r border-black/5 dark:border-white/5",
            ]
      )}
    >
      {/* Top icons */}
      <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
        {TOP_ITEMS.map(({ id, icon: Icon, label }) => {
          // Only show as active if sidebar is visible
          const isActive = activePanel === id && !sidebarCollapsed;
          return (
            <button
              key={id}
              onClick={() => handlePanelClick(id)}
              title={label}
              className={cn(
                "w-10 h-10 flex items-center justify-center relative rounded-lg mx-1",
                "transition-all duration-150",
                isActive
                  ? [
                      useLiquidGlass
                        ? "liquid-glass-button bg-black/10 dark:bg-white/10"
                        : "bg-black/10 dark:bg-white/10",
                      isDark ? "text-white" : "text-neutral-900",
                    ]
                  : [
                      isDark
                        ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                        : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                    ]
              )}
            >
              {/* Active indicator - subtle border on outer edge */}
              {isActive && (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-0.5 h-5",
                    isRight ? "right-0 rounded-l" : "left-0 rounded-r",
                    isDark ? "bg-white" : "bg-neutral-900"
                  )}
                />
              )}
              <Icon className="w-[18px] h-[18px]" />
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center py-2 gap-0.5">
        {/* Problems panel toggle */}
        <button
          onClick={() => {
            if (bottomPanelOpen) {
              toggleBottomPanel();
            } else {
              openBottomPanelTab("problems");
            }
          }}
          title="Problems"
          className={cn(
            "w-10 h-10 flex items-center justify-center relative rounded-lg mx-1",
            "transition-all duration-150",
            bottomPanelOpen
              ? [
                  useLiquidGlass
                    ? "liquid-glass-button bg-black/10 dark:bg-white/10"
                    : "bg-black/10 dark:bg-white/10",
                  isDark ? "text-white" : "text-neutral-900",
                ]
              : [
                  isDark
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                ]
          )}
        >
          <AlertCircle className="w-[18px] h-[18px]" />
          {/* Problems badge */}
          {problemsSummary.total > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1",
                "flex items-center justify-center",
                "text-[10px] font-medium rounded-full",
                problemsSummary.errors > 0
                  ? "bg-red-500 text-white"
                  : "bg-yellow-500 text-white"
              )}
            >
              {problemsSummary.total > 99 ? "99+" : problemsSummary.total}
            </span>
          )}
        </button>

        {/* Settings panel */}
        <button
          onClick={() => handlePanelClick("settings")}
          title="Settings"
          className={cn(
            "w-10 h-10 flex items-center justify-center relative rounded-lg mx-1",
            "transition-all duration-150",
            activePanel === "settings" && !sidebarCollapsed
              ? [
                  useLiquidGlass
                    ? "liquid-glass-button bg-black/10 dark:bg-white/10"
                    : "bg-black/10 dark:bg-white/10",
                  isDark ? "text-white" : "text-neutral-900",
                ]
              : [
                  isDark
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                ]
          )}
        >
          {activePanel === "settings" && !sidebarCollapsed && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-0.5 h-5",
                isRight ? "right-0 rounded-l" : "left-0 rounded-r",
                isDark ? "bg-white" : "bg-neutral-900"
              )}
            />
          )}
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}
