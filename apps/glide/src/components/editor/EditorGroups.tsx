/**
 * Editor Groups Component
 *
 * Container for multiple editor groups (split views).
 * Manages horizontal layout with resizable dividers.
 */

import { Fragment, useCallback, useState, useRef, useEffect } from "react";
import { useTabsStore } from "../../stores/tabs";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { EditorGroup } from "./EditorGroup";
import { cn } from "../../lib/utils";

/** Minimum width for a group in pixels */
const MIN_GROUP_WIDTH = 200;

export function EditorGroups() {
  const groups = useTabsStore((s) => s.groups);
  const activeGroupId = useTabsStore((s) => s.activeGroupId);

  // Track group widths as percentages (undefined = equal distribution)
  const [groupWidths, setGroupWidths] = useState<number[]>([]);

  // Reset widths when group count changes
  useEffect(() => {
    if (groups.length > 0 && groupWidths.length !== groups.length) {
      // Initialize with equal distribution
      setGroupWidths(groups.map(() => 100 / groups.length));
    }
  }, [groups.length]);

  // Note: Groups are NOT auto-closed when empty.
  // They are only closed via explicit user action (context menu "Close Group")
  // or when closeAllTabs is called on a non-primary group.

  if (groups.length === 0) {
    return <EmptyState />;
  }

  if (groups.length === 1) {
    // Single group - no split UI needed
    return <EditorGroup groupId={groups[0].id} isActive={true} />;
  }

  // Multiple groups - horizontal split with resizable dividers
  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && (
            <ResizableDivider
              index={index}
              groupWidths={groupWidths}
              setGroupWidths={setGroupWidths}
            />
          )}
          <div
            className="min-w-0 min-h-0 flex"
            style={{
              width: groupWidths[index]
                ? `${groupWidths[index]}%`
                : `${100 / groups.length}%`,
            }}
          >
            <EditorGroup
              groupId={group.id}
              isActive={group.id === activeGroupId}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

interface ResizableDividerProps {
  index: number;
  groupWidths: number[];
  setGroupWidths: React.Dispatch<React.SetStateAction<number[]>>;
}

function ResizableDivider({
  index,
  groupWidths,
  setGroupWidths,
}: ResizableDividerProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      // Current widths of adjacent groups
      const leftWidth = groupWidths[index - 1] ?? 100 / groupWidths.length;
      const rightWidth = groupWidths[index] ?? 100 / groupWidths.length;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;

        // Calculate new widths
        let newLeftWidth = leftWidth + deltaPercent;
        let newRightWidth = rightWidth - deltaPercent;

        // Enforce minimum widths
        const minPercent = (MIN_GROUP_WIDTH / containerWidth) * 100;

        if (newLeftWidth < minPercent) {
          newLeftWidth = minPercent;
          newRightWidth = leftWidth + rightWidth - minPercent;
        }

        if (newRightWidth < minPercent) {
          newRightWidth = minPercent;
          newLeftWidth = leftWidth + rightWidth - minPercent;
        }

        setGroupWidths((prev) => {
          const next = [...prev];
          next[index - 1] = newLeftWidth;
          next[index] = newRightWidth;
          return next;
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [index, groupWidths, setGroupWidths]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={cn(
        "w-1 flex-shrink-0 cursor-col-resize relative group",
        isDark ? "bg-neutral-800" : "bg-neutral-200",
        isDragging && (isDark ? "bg-violet-500" : "bg-violet-400")
      )}
    >
      {/* Wider hit area */}
      <div
        className={cn(
          "absolute inset-y-0 -left-1 -right-1 z-10",
          "group-hover:bg-violet-500/20",
          isDragging && "bg-violet-500/30"
        )}
      />
    </div>
  );
}

function EmptyState() {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "flex-1 flex items-center justify-center",
        isDark ? "bg-neutral-900/50 text-neutral-500" : "bg-white/50 text-neutral-400"
      )}
    >
      <p>No editor groups</p>
    </div>
  );
}
