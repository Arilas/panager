/**
 * Stash section component for GitPanel
 */

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Trash2,
  Play,
  Copy,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { GitStashEntry } from "../../types";

export function StashPanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const { stashes, stashesLoading, loadStashes, stashPop, stashApply, stashDrop } =
    useGitStore();
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const [expanded, setExpanded] = useState(true);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (projectContext) {
      loadStashes(projectContext.projectPath);
    }
  }, [projectContext, loadStashes]);

  const handlePop = async (index: number) => {
    if (!projectContext) return;
    setActionLoading(index);
    try {
      await stashPop(projectContext.projectPath, index);
    } catch (error) {
      console.error("Failed to pop stash:", error);
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  const handleApply = async (index: number) => {
    if (!projectContext) return;
    setActionLoading(index);
    try {
      await stashApply(projectContext.projectPath, index);
    } catch (error) {
      console.error("Failed to apply stash:", error);
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  const handleDrop = async (index: number) => {
    if (!projectContext) return;
    setActionLoading(index);
    try {
      await stashDrop(projectContext.projectPath, index);
    } catch (error) {
      console.error("Failed to drop stash:", error);
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  if (stashes.length === 0 && !stashesLoading) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1 w-full px-3 py-1.5 text-xs font-medium",
          isDark
            ? "text-neutral-400 hover:bg-white/5"
            : "text-neutral-500 hover:bg-black/5"
        )}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <Package className="w-3.5 h-3.5 mr-1" />
        Stashes
        <span className={cn("ml-1", isDark ? "text-neutral-500" : "text-neutral-400")}>
          ({stashes.length})
        </span>
        {stashesLoading && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
      </button>

      {expanded && (
        <div>
          {stashes.map((stash) => (
            <StashItem
              key={stash.oid}
              stash={stash}
              isDark={isDark}
              isActiveMenu={activeMenu === stash.index}
              isLoading={actionLoading === stash.index}
              onToggleMenu={() =>
                setActiveMenu(activeMenu === stash.index ? null : stash.index)
              }
              onPop={() => handlePop(stash.index)}
              onApply={() => handleApply(stash.index)}
              onDrop={() => handleDrop(stash.index)}
              formatTime={formatRelativeTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StashItemProps {
  stash: GitStashEntry;
  isDark: boolean;
  isActiveMenu: boolean;
  isLoading: boolean;
  onToggleMenu: () => void;
  onPop: () => void;
  onApply: () => void;
  onDrop: () => void;
  formatTime: (timestamp: number) => string;
}

function StashItem({
  stash,
  isDark,
  isActiveMenu,
  isLoading,
  onToggleMenu,
  onPop,
  onApply,
  onDrop,
  formatTime,
}: StashItemProps) {
  // Extract message without "On branch" prefix
  const displayMessage =
    stash.message.replace(/^On \w+: /, "").substring(0, 50) ||
    `stash@{${stash.index}}`;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-4 py-1.5 text-sm",
        "transition-colors",
        isDark ? "hover:bg-white/5" : "hover:bg-black/5"
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 text-neutral-500 animate-spin shrink-0" />
      ) : (
        <Package className="w-4 h-4 text-orange-500 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span
          className={cn("truncate block", isDark ? "text-neutral-300" : "text-neutral-700")}
        >
          {displayMessage}
        </span>
        <span
          className={cn("text-xs", isDark ? "text-neutral-500" : "text-neutral-400")}
        >
          {formatTime(stash.time)}
        </span>
      </div>

      {/* Actions */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className={cn(
            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            isDark ? "hover:bg-white/10" : "hover:bg-black/10"
          )}
        >
          <MoreHorizontal className="w-4 h-4 text-neutral-500" />
        </button>

        {isActiveMenu && (
          <div
            className={cn(
              "absolute right-0 top-full mt-1 z-50 min-w-[140px]",
              "rounded-md shadow-lg py-1",
              isDark ? "bg-neutral-800 border border-white/10" : "bg-white border border-black/10"
            )}
          >
            <button
              onClick={onPop}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              <Play className="w-4 h-4" />
              Pop
            </button>
            <button
              onClick={onApply}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              <Copy className="w-4 h-4" />
              Apply
            </button>
            <button
              onClick={onDrop}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-red-500",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              <Trash2 className="w-4 h-4" />
              Drop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
