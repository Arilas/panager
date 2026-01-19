/**
 * Status Bar - Bottom bar with file info
 *
 * Styled with glass effects and theme support to match Panager's design.
 * Displays plugin status bar items (like TypeScript version) from the plugins store.
 */

import { useMemo } from "react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { usePluginsStore } from "../../stores/plugins";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import { BranchSelector } from "../git/BranchSelector";

export function StatusBar() {
  const cursorPosition = useIdeStore((s) => s.cursorPosition);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const openFiles = useFilesStore((s) => s.openFiles);
  const statusBarItems = usePluginsStore((s) => s.statusBarItems);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

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
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div
      className={cn(
        "h-6 flex items-center px-3 text-xs shrink-0",
        useLiquidGlass
          ? "liquid-glass-sidebar"
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

        {/* Language */}
        {activeFile && (
          <span className="capitalize">{activeFile.language}</span>
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
