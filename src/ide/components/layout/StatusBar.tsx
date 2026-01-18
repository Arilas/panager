/**
 * Status Bar - Bottom bar with file info
 *
 * Styled with glass effects and theme support to match Panager's design.
 */

import { GitBranch } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useGitStore } from "../../stores/git";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";

export function StatusBar() {
  const cursorPosition = useIdeStore((s) => s.cursorPosition);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const openFiles = useFilesStore((s) => s.openFiles);
  const branch = useGitStore((s) => s.branch);
  const { useLiquidGlass, effectiveTheme } = useIdeSettingsContext();

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
      {/* Left section - Git branch */}
      <div className="flex items-center gap-2">
        {branch && (
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="font-medium">{branch.name}</span>
            {(branch.ahead > 0 || branch.behind > 0) && (
              <span className="opacity-60">
                {branch.ahead > 0 && `↑${branch.ahead}`}
                {branch.behind > 0 && `↓${branch.behind}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section - File info */}
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
      </div>
    </div>
  );
}
