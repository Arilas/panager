/**
 * Right Activity Bar - Agent/Chat panel controls
 *
 * Vertical icon bar on the far right that toggles the right sidebar panels.
 * Contains icons for Chat and Tasks panels.
 */

import { MessageSquare, ListTodo } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useAgentStore } from "../../stores/agent";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { RightSidebarPanel } from "../../types/acp";

interface ActivityItem {
  id: Exclude<RightSidebarPanel, null>;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const ITEMS: ActivityItem[] = [
  { id: "chat", icon: MessageSquare, label: "Chat" },
  { id: "tasks", icon: ListTodo, label: "Tasks" },
];

export function RightActivityBar() {
  const rightSidebarPanel = useIdeStore((s) => s.rightSidebarPanel);
  const rightSidebarCollapsed = useIdeStore((s) => s.rightSidebarCollapsed);
  const setRightSidebarPanel = useIdeStore((s) => s.setRightSidebarPanel);
  const toggleRightSidebarPanel = useIdeStore((s) => s.toggleRightSidebarPanel);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

  // Get agent status for indicator
  const status = useAgentStore((s) => s.status);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);

  const isDark = effectiveTheme === "dark";

  const handlePanelClick = (panelId: Exclude<RightSidebarPanel, null>) => {
    if (rightSidebarCollapsed) {
      // If sidebar is collapsed, open it with the clicked panel
      setRightSidebarPanel(panelId);
      useIdeStore.setState({ rightSidebarCollapsed: false });
    } else {
      // Otherwise toggle as normal
      toggleRightSidebarPanel(panelId);
    }
  };

  // Count pending approvals for badge
  const pendingCount = pendingApprovals.filter((a) => a.status === "pending").length;

  return (
    <div
      className={cn(
        "flex flex-col w-12 shrink-0",
        useLiquidGlass
          ? "liquid-glass-sidebar"
          : ["bg-vibrancy-sidebar", "border-l border-black/5 dark:border-white/5"]
      )}
    >
      {/* Icons */}
      <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
        {ITEMS.map(({ id, icon: Icon, label }) => {
          // Only show as active if sidebar is visible
          const isActive = rightSidebarPanel === id && !rightSidebarCollapsed;
          const showBadge = id === "chat" && pendingCount > 0;
          const showStatusDot = id === "chat" && status === "prompting";

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
              {/* Active indicator - subtle border on outer edge (right side) */}
              {isActive && (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-0.5 h-5 right-0 rounded-l",
                    isDark ? "bg-white" : "bg-neutral-900"
                  )}
                />
              )}
              <Icon className="w-[18px] h-[18px]" />

              {/* Pending approvals badge */}
              {showBadge && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1",
                    "flex items-center justify-center",
                    "text-[10px] font-medium rounded-full",
                    "bg-amber-500 text-white"
                  )}
                >
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}

              {/* Status indicator (pulsing when prompting) */}
              {showStatusDot && !showBadge && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full",
                    "bg-green-500 animate-pulse"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
