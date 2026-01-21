/**
 * Branch selector dropdown component
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  GitBranch,
  ChevronDown,
  Check,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { GitLocalBranch } from "../../types";

interface BranchSelectorProps {
  compact?: boolean;
}

export function BranchSelector({ compact: _compact = false }: BranchSelectorProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const {
    branch,
    branches,
    branchesLoading,
    loadBranches,
    switchBranch,
    checkUncommittedChanges,
  } = useGitStore();
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load branches when dropdown opens
  useEffect(() => {
    if (isOpen && projectContext) {
      loadBranches(projectContext.projectPath);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen, projectContext, loadBranches]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowWarning(null);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSwitchBranch = useCallback(
    async (branchName: string) => {
      if (!projectContext || branchName === branch?.name) return;

      // Check for uncommitted changes
      const hasChanges = await checkUncommittedChanges(projectContext.projectPath);
      if (hasChanges) {
        setShowWarning(branchName);
        return;
      }

      setSwitching(branchName);
      try {
        await switchBranch(projectContext.projectPath, branchName);
        setIsOpen(false);
        setSearchQuery("");
      } catch (error) {
        console.error("Failed to switch branch:", error);
      } finally {
        setSwitching(null);
      }
    },
    [projectContext, branch, switchBranch, checkUncommittedChanges]
  );

  const handleConfirmSwitch = useCallback(async () => {
    if (!projectContext || !showWarning) return;

    setSwitching(showWarning);
    try {
      await switchBranch(projectContext.projectPath, showWarning);
      setIsOpen(false);
      setSearchQuery("");
      setShowWarning(null);
    } catch (error) {
      console.error("Failed to switch branch:", error);
    } finally {
      setSwitching(null);
    }
  }, [projectContext, showWarning, switchBranch]);

  if (!branch) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-sm",
          isDark ? "hover:bg-white/10" : "hover:bg-black/10"
        )}
      >
        <GitBranch className="w-4 h-4" />
        <span className="truncate max-w-[120px]">{branch.name}</span>
        {branch.ahead > 0 && (
          <span className="flex items-center text-xs text-green-500">
            <ArrowUp className="w-3 h-3" />
            {branch.ahead}
          </span>
        )}
        {branch.behind > 0 && (
          <span className="flex items-center text-xs text-orange-500">
            <ArrowDown className="w-3 h-3" />
            {branch.behind}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-neutral-500" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 bottom-full mb-1 z-50 min-w-[240px] max-w-[300px]",
            "rounded-lg shadow-xl overflow-hidden",
            isDark
              ? "bg-neutral-900 border border-white/10"
              : "bg-white border border-black/10"
          )}
        >
          {/* Search */}
          <div className="p-2">
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded",
                isDark ? "bg-white/5" : "bg-black/5"
              )}
            >
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search branches..."
                className={cn(
                  "flex-1 bg-transparent text-sm outline-none",
                  isDark
                    ? "text-white placeholder-neutral-500"
                    : "text-neutral-900 placeholder-neutral-400"
                )}
              />
            </div>
          </div>

          {/* Warning dialog */}
          {showWarning && (
            <div className={cn("px-3 py-2 border-b", isDark ? "border-white/10 bg-yellow-500/10" : "border-black/10 bg-yellow-50")}>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                You have uncommitted changes. Switch anyway?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmSwitch}
                  className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Switch Anyway
                </button>
                <button
                  onClick={() => setShowWarning(null)}
                  className={cn(
                    "px-2 py-1 text-xs rounded",
                    isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/10 hover:bg-black/20"
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Branch list */}
          <div className="max-h-[300px] overflow-auto py-1">
            {branchesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
              </div>
            ) : filteredBranches.length === 0 ? (
              <div
                className={cn(
                  "px-3 py-2 text-sm",
                  isDark ? "text-neutral-500" : "text-neutral-400"
                )}
              >
                No branches found
              </div>
            ) : (
              filteredBranches.map((b) => (
                <BranchItem
                  key={b.name}
                  branch={b}
                  isCurrent={b.name === branch.name}
                  isSwitching={switching === b.name}
                  isDark={isDark}
                  onSwitch={() => handleSwitchBranch(b.name)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface BranchItemProps {
  branch: GitLocalBranch;
  isCurrent: boolean;
  isSwitching: boolean;
  isDark: boolean;
  onSwitch: () => void;
}

function BranchItem({
  branch,
  isCurrent,
  isSwitching,
  isDark,
  onSwitch,
}: BranchItemProps) {
  return (
    <button
      onClick={onSwitch}
      disabled={isCurrent || isSwitching}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
        "transition-colors",
        isCurrent
          ? isDark
            ? "bg-white/10"
            : "bg-black/10"
          : isDark
          ? "hover:bg-white/5"
          : "hover:bg-black/5",
        (isCurrent || isSwitching) && "cursor-default"
      )}
    >
      {isSwitching ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
      ) : isCurrent ? (
        <Check className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <GitBranch className="w-4 h-4 text-neutral-500 shrink-0" />
      )}

      <span className={cn("truncate flex-1", isDark ? "text-neutral-200" : "text-neutral-800")}>
        {branch.name}
      </span>

      {/* Ahead/behind */}
      <div className="flex items-center gap-1 text-xs">
        {branch.ahead > 0 && (
          <span className="flex items-center text-green-500">
            <ArrowUp className="w-3 h-3" />
            {branch.ahead}
          </span>
        )}
        {branch.behind > 0 && (
          <span className="flex items-center text-orange-500">
            <ArrowDown className="w-3 h-3" />
            {branch.behind}
          </span>
        )}
      </div>
    </button>
  );
}
