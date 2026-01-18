/**
 * Editor Tabs Component
 *
 * Styled with theme support to match Panager's design.
 */

import { X, File, Circle } from "lucide-react";
import { useFilesStore } from "../../stores/files";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";

export function EditorTabs() {
  const openFiles = useFilesStore((s) => s.openFiles);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const setActiveFile = useFilesStore((s) => s.setActiveFile);
  const closeFile = useFilesStore((s) => s.closeFile);
  const { effectiveTheme, useLiquidGlass } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "relative shrink-0 h-[32px]",
        useLiquidGlass
          ? "bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5"
          : [
              isDark ? "bg-neutral-900/80" : "bg-neutral-100/80",
              "border-b border-black/5 dark:border-white/5",
            ]
      )}
    >
      <div className="absolute inset-0 flex overflow-x-auto overflow-y-hidden tabs-scrollbar items-center">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        const fileName = file.path.split("/").pop() || file.path;

        return (
          <div
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            className={cn(
              "group flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer",
              "transition-colors min-w-[120px] max-w-[200px] shrink-0",
              "border-r border-black/5 dark:border-white/5",
              isActive
                ? [
                    useLiquidGlass
                      ? "bg-white/10 dark:bg-white/10"
                      : isDark
                        ? "bg-neutral-800/50"
                        : "bg-white/80",
                    isDark ? "text-neutral-100" : "text-neutral-900",
                  ]
                : [
                    "bg-transparent",
                    isDark
                      ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                      : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                  ]
            )}
          >
            <File className="w-3.5 h-3.5 shrink-0 opacity-60" />
            <span className="truncate">{fileName}</span>
            {/* Close button or dirty indicator */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={cn(
                "p-0.5 rounded transition-colors shrink-0 relative",
                isDark ? "hover:bg-white/10" : "hover:bg-black/10",
                // Show X on hover for dirty files, always show dirty indicator otherwise
                file.isDirty
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
            >
              {/* Dirty indicator (dot) - hidden on hover */}
              {file.isDirty && (
                <Circle
                  className={cn(
                    "w-2.5 h-2.5 fill-current group-hover:hidden",
                    isDark ? "text-neutral-400" : "text-neutral-500"
                  )}
                />
              )}
              {/* Close X - shown on hover or when not dirty */}
              <X
                className={cn(
                  "w-3 h-3",
                  file.isDirty ? "hidden group-hover:block" : ""
                )}
              />
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
