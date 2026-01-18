/**
 * VS Code-style Activity Bar
 *
 * Vertical icon bar on the far left that toggles sidebar panels.
 */

import { Files, GitBranch, Search, Settings } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
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

export function ActivityBar() {
  const activePanel = useIdeStore((s) => s.activePanel);
  const togglePanel = useIdeStore((s) => s.togglePanel);

  return (
    <div className="flex flex-col w-12 bg-neutral-950 border-r border-neutral-800 shrink-0">
      {/* Top icons */}
      <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
        {TOP_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activePanel === id;
          return (
            <button
              key={id}
              onClick={() => togglePanel(id)}
              title={label}
              className={cn(
                "w-12 h-10 flex items-center justify-center relative",
                "transition-colors",
                isActive
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center py-2">
        <button
          title="Settings"
          className="w-12 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
