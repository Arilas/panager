/**
 * Clipboard Indicator Component
 *
 * Shows a visual indicator at the bottom of the file tree when items are
 * copied or cut to the clipboard, with an option to clear.
 */

import { Clipboard, Scissors, X } from "lucide-react";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface ClipboardIndicatorProps {
  /** Array of file/folder paths in the clipboard */
  items: string[];
  /** The clipboard operation type */
  operation: "copy" | "cut";
  /** Called when the user clicks the clear button */
  onClear: () => void;
}

export function ClipboardIndicator({
  items,
  operation,
  onClear,
}: ClipboardIndicatorProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  if (items.length === 0) return null;

  // Get just the file/folder name from the first item
  const firstName = items[0].substring(items[0].lastIndexOf("/") + 1);
  const displayName =
    items.length === 1
      ? firstName
      : `${firstName} and ${items.length - 1} more`;

  const operationLabel = operation === "cut" ? "ready to move" : "copied";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs",
        "border-t",
        isDark
          ? "bg-neutral-900/50 border-white/5 text-neutral-400"
          : "bg-neutral-50 border-black/5 text-neutral-500"
      )}
    >
      {/* Icon */}
      {operation === "cut" ? (
        <Scissors className="w-3.5 h-3.5 shrink-0 text-orange-500" />
      ) : (
        <Clipboard className="w-3.5 h-3.5 shrink-0 text-blue-500" />
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <span className="truncate block" title={items.join("\n")}>
          {items.length} {items.length === 1 ? "item" : "items"} {operationLabel}
        </span>
        <span
          className={cn(
            "truncate block text-[11px]",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
          title={items[0]}
        >
          {displayName}
        </span>
      </div>

      {/* Clear button */}
      <button
        onClick={onClear}
        className={cn(
          "p-1 rounded transition-colors shrink-0",
          isDark ? "hover:bg-white/10" : "hover:bg-black/10"
        )}
        title="Clear clipboard"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
