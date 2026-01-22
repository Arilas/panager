/**
 * Editor Group Tab Component
 *
 * A single tab in the editor tab bar.
 * Handles rendering, drag-and-drop, and user interactions.
 */

import { forwardRef } from "react";
import { X, Circle, Pin, Loader2 } from "lucide-react";
import { useTabsStore } from "../../stores/tabs";
import {
  useEffectiveTheme,
  useLiquidGlass,
} from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { TabEntry } from "../../lib/tabs/types";
import type { GitFileStatus } from "../../types";

/** Get color class for git status */
function getGitStatusColor(
  status: GitFileStatus | undefined,
): string | undefined {
  if (!status) return undefined;

  switch (status) {
    case "modified":
      return "text-amber-500";
    case "added":
    case "untracked":
      return "text-green-500";
    case "deleted":
      return "text-red-500";
    case "renamed":
      return "text-blue-500";
    case "conflicted":
      return "text-red-600";
    default:
      return undefined;
  }
}

export interface EditorGroupTabProps {
  tab: TabEntry;
  tabIndex: number;
  isActive: boolean;
  isGroupActive: boolean;
  isDragging: boolean;
  showDropIndicator: boolean;
  filePath: string | null;
  gitStatus: GitFileStatus | undefined;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClose: () => void;
}

export const EditorGroupTab = forwardRef<HTMLDivElement, EditorGroupTabProps>(
  function EditorGroupTab(
    {
      tab,
      isActive,
      isDragging,
      showDropIndicator,
      filePath,
      gitStatus,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd,
      onClick,
      onDoubleClick,
      onContextMenu,
      onClose,
    },
    ref,
  ) {
    const registry = useTabsStore((s) => s.registry);
    const effectiveTheme = useEffectiveTheme();
    const liquidGlass = useLiquidGlass();
    const isDark = effectiveTheme === "dark";

    const gitStatusColor = getGitStatusColor(gitStatus);

    // Get icon from resolver
    const getTabIcon = () => {
      // Show loading spinner for active unresolved tab
      if (!tab.resolved && !tab.error && isActive) {
        return (
          <Loader2
            className={cn(
              "w-3.5 h-3.5 shrink-0 animate-spin",
              isDark ? "text-neutral-400" : "text-neutral-500",
            )}
          />
        );
      }

      // Show pin icon for pinned tabs
      if (tab.isPinned) {
        return (
          <Pin
            className={cn(
              "w-3 h-3 shrink-0",
              isDark ? "text-violet-400" : "text-violet-500",
            )}
          />
        );
      }

      // Get icon from resolver
      if (registry) {
        const resolver = registry.findResolver(tab.url);
        if (resolver) {
          const iconClassName = cn(
            "w-3.5 h-3.5 shrink-0",
            // TODO: Move to resolver side
            tab.type === "diff" && "text-blue-500",
            tab.type === "chat" && "text-violet-500",
            tab.type === "file" && cn("opacity-60", gitStatusColor),
            tab.type === "markdown" && cn("opacity-60", gitStatusColor),
          );
          return resolver.getIcon(tab.url, iconClassName);
        }
      }

      return null;
    };

    return (
      <div
        ref={ref}
        draggable={!tab.isPreview}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        title={filePath ?? tab.displayName}
        className={cn(
          "group flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] cursor-pointer select-none",
          "transition-colors min-w-[120px] max-w-[240px] shrink-0 relative",
          "border-r border-black/5 dark:border-white/5",
          isActive
            ? [
                liquidGlass
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
              ],
          isDragging && "opacity-50",
          tab.isPinned && "border-r-2 border-r-violet-500/30",
        )}
      >
        {/* Drop indicator */}
        {showDropIndicator && (
          <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-violet-500 rounded-full" />
        )}

        {/* Tab content */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getTabIcon()}
          <span
            className={cn(
              "truncate min-w-0",
              tab.isPreview && "italic",
              tab.type !== "diff" && gitStatusColor,
            )}
          >
            {tab.displayName}
          </span>
        </div>

        {/* Close button or dirty indicator */}
        {tab.isPinned ? (
          tab.isDirty && (
            <Circle
              className={cn(
                "w-2.5 h-2.5 fill-current shrink-0",
                isDark ? "text-neutral-400" : "text-neutral-500",
              )}
            />
          )
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={cn(
              "p-0.5 rounded transition-colors shrink-0 relative",
              isDark ? "hover:bg-white/10" : "hover:bg-black/10",
              tab.isDirty ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              isActive && "opacity-100",
            )}
          >
            {tab.isDirty && (
              <Circle
                className={cn(
                  "w-2.5 h-2.5 fill-current group-hover:hidden",
                  isDark ? "text-neutral-400" : "text-neutral-500",
                )}
              />
            )}
            <X
              className={cn(
                "w-3 h-3",
                tab.isDirty ? "hidden group-hover:block" : "",
              )}
            />
          </button>
        )}
      </div>
    );
  },
);
