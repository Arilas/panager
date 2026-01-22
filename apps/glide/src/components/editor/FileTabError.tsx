/**
 * File Tab Error Component
 *
 * Displayed when a file tab fails to resolve (file not found, read error, etc.)
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { TabErrorProps } from "../../lib/tabs/types";

export function FileTabError({ url, error, onRetry }: TabErrorProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  // Extract filename from URL for display
  const filename = url.replace("file://", "").split("/").pop() || url;

  return (
    <div
      className={cn(
        "h-full w-full flex flex-col items-center justify-center gap-4 p-8",
        isDark ? "bg-neutral-900 text-neutral-300" : "bg-white text-neutral-600"
      )}
    >
      <AlertCircle
        className={cn(
          "w-12 h-12",
          isDark ? "text-red-400" : "text-red-500"
        )}
      />

      <div className="text-center space-y-2">
        <h3
          className={cn(
            "text-lg font-medium",
            isDark ? "text-neutral-200" : "text-neutral-800"
          )}
        >
          Unable to open file
        </h3>
        <p className="text-sm max-w-md">
          <span className="font-mono">{filename}</span>
        </p>
        <p
          className={cn(
            "text-sm",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {error}
        </p>
      </div>

      <button
        onClick={onRetry}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors",
          isDark
            ? "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
            : "bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
        )}
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}
