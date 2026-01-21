/**
 * Status Bar - Bottom bar with file info
 *
 * Styled with glass effects and theme support to match Panager's design.
 * Displays plugin status bar items (like TypeScript version) from the plugins store.
 */

import { useMemo } from "react";
import { useIdeStore } from "../../stores/ide";
import { useEditorStore, isFileTab } from "../../stores/editor";
import { usePluginsStore } from "../../stores/plugins";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import { BranchSelector } from "../git/BranchSelector";

export function StatusBar() {
  const cursorPosition = useIdeStore((s) => s.cursorPosition);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const tabStates = useEditorStore((s) => s.tabStates);
  const previewTab = useEditorStore((s) => s.previewTab);
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

  // Get active tab state (from permanent tabs or preview) - only file tabs have language info
  const activeFileState = useMemo(() => {
    if (!activeTabPath) return null;
    if (previewTab?.path === activeTabPath && isFileTab(previewTab)) {
      return previewTab;
    }
    const tabState = tabStates[activeTabPath];
    if (tabState && isFileTab(tabState)) {
      return tabState;
    }
    return null;
  }, [activeTabPath, previewTab, tabStates]);

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
        {/* Cursor position */}
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}

        {/* Language (only for file tabs) */}
        {activeFileState && (
          <span className="capitalize">{activeFileState.language}</span>
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
