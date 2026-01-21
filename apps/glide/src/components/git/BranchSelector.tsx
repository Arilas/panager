/**
 * Branch selector button component
 *
 * Displays current branch and opens the BranchSwitchDialog when clicked.
 */

import { GitBranch, ArrowUp, ArrowDown } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface BranchSelectorProps {
  compact?: boolean;
}

export function BranchSelector({ compact: _compact = false }: BranchSelectorProps) {
  const setShowBranchSwitch = useIdeStore((s) => s.setShowBranchSwitch);
  const branch = useGitStore((s) => s.branch);
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  if (!branch) return null;

  return (
    <button
      onClick={() => setShowBranchSwitch(true)}
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
    </button>
  );
}
