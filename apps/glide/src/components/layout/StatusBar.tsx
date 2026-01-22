/**
 * Status Bar - Bottom bar with file info
 *
 * Styled with glass effects and theme support to match Panager's design.
 * Displays plugin status bar items (like TypeScript version) from the plugins store.
 */

import { useMemo } from "react";
import { useIdeStore } from "../../stores/ide";
import { useTabsStore } from "../../stores/tabs";
import { usePluginsStore } from "../../stores/plugins";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import { BranchSelector } from "../git/BranchSelector";
import { isFileUrl } from "../../lib/tabs/url";
import type { FileTabData } from "../../lib/tabs/types";

export function StatusBar() {
  const cursorPosition = useIdeStore((s) => s.cursorPosition);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const activeGroupId = useTabsStore((s) => s.activeGroupId);
  const groups = useTabsStore((s) => s.groups);
  const statusBarItems = usePluginsStore((s) => s.statusBarItems);
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  // Memoize filtered items to avoid re-renders
  const leftStatusItems = useMemo(
    () => statusBarItems.filter((item) => item.alignment === "left"),
    [statusBarItems]
  );
  const rightStatusItems = useMemo(
    () => statusBarItems.filter((item) => item.alignment === "right"),
    [statusBarItems]
  );

  const isDark = effectiveTheme === "dark";

  // Get active tab language from the tabs store
  const activeFileLanguage = useMemo(() => {
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    if (!activeGroup?.activeUrl) return null;

    const activeTab = activeGroup.tabs.find((t) => t.url === activeGroup.activeUrl);
    if (!activeTab?.resolved) return null;

    // Only file tabs have language info
    if (!isFileUrl(activeTab.url)) return null;

    const data = activeTab.resolved.data as FileTabData;
    return data?.language ?? null;
  }, [groups, activeGroupId]);

  return (
    <div
      className={cn(
        "h-6 flex items-center px-3 text-xs shrink-0",
        liquidGlass
          ? "liquid-glass-sidebar liquid-glass-status-bar"
          : [
              isDark ? "bg-neutral-900/95" : "bg-neutral-100/95",
              "border-t border-black/5 dark:border-white/5",
            ],
        isDark ? "text-neutral-400" : "text-neutral-600"
      )}
    >
      {/* Left section - Git branch selector and plugin items */}
      <div className="flex items-center gap-3">
        <BranchSelector compact />

        {/* Left-aligned plugin status bar items */}
        {leftStatusItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1 cursor-default"
            title={item.tooltip}
          >
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section - File info and plugin items */}
      <div className="flex items-center gap-4">
        {/* Cursor position - clickable to open Go to Line */}
        {cursorPosition && (
          <button
            onClick={() => setShowGoToLine(true)}
            className="hover:text-foreground transition-colors"
          >
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </button>
        )}

        {/* Language (only for file tabs) */}
        {activeFileLanguage && (
          <span className="capitalize">{activeFileLanguage}</span>
        )}

        {/* Encoding */}
        <span>UTF-8</span>

        {/* Right-aligned plugin status bar items (e.g., TypeScript version) */}
        {rightStatusItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1 cursor-default"
            title={item.tooltip}
          >
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
