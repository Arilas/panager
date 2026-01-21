/**
 * Quick commit input component for GitPanel
 */

import { useState, useCallback } from "react";
import { Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface CommitInputProps {
  stagedCount: number;
}

export function CommitInput({ stagedCount }: CommitInputProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const {
    commitMessage,
    setCommitMessage,
    commitAmend,
    setCommitAmend,
    commitLoading,
    commit,
  } = useGitStore();
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCommit = stagedCount > 0 && commitMessage.trim().length > 0 && !commitLoading;

  const handleCommit = useCallback(async () => {
    if (!projectContext || !canCommit) return;

    setError(null);
    try {
      await commit(projectContext.projectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectContext, canCommit, commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl + Enter to commit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit]
  );

  return (
    <div
      className={cn(
        "px-3 py-2 border-b",
        isDark ? "border-white/5" : "border-black/5"
      )}
    >
      {/* Row 1: Input + Expand button */}
      <div className="flex items-start gap-2">
        {expanded ? (
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commit message..."
            rows={3}
            className={cn(
              "flex-1 px-2 py-1.5 text-sm rounded resize-none",
              "outline-none focus:ring-1",
              isDark
                ? "bg-white/5 text-white placeholder-neutral-500 focus:ring-blue-500/50"
                : "bg-black/5 text-neutral-900 placeholder-neutral-400 focus:ring-blue-500/50"
            )}
          />
        ) : (
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commit message..."
            className={cn(
              "flex-1 px-2 py-1.5 text-sm rounded",
              "outline-none focus:ring-1",
              isDark
                ? "bg-white/5 text-white placeholder-neutral-500 focus:ring-blue-500/50"
                : "bg-black/5 text-neutral-900 placeholder-neutral-400 focus:ring-blue-500/50"
            )}
          />
        )}

        {/* Expand/collapse button - fixed size */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-8 h-8 rounded transition-colors shrink-0",
            "flex items-center justify-center",
            isDark ? "hover:bg-white/10" : "hover:bg-black/10"
          )}
          title={expanded ? "Collapse" : "Expand for multi-line message"}
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          )}
        </button>
      </div>

      {/* Amend checkbox (when expanded) */}
      {expanded && (
        <label
          className={cn(
            "flex items-center gap-2 mt-2 text-xs cursor-pointer",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          <input
            type="checkbox"
            checked={commitAmend}
            onChange={(e) => setCommitAmend(e.target.checked)}
            className="rounded"
          />
          Amend previous commit
        </label>
      )}

      {/* Row 2: Status message + Commit button */}
      <div className="flex items-center justify-between mt-2">
        {/* Left: Status or hint */}
        <div className="flex-1 min-w-0">
          {error ? (
            <p className="text-xs text-red-500 truncate">{error}</p>
          ) : stagedCount === 0 ? (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}
            >
              Stage files to commit
            </p>
          ) : (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              {stagedCount} file{stagedCount !== 1 ? "s" : ""} staged
            </p>
          )}
        </div>

        {/* Right: Commit button */}
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          className={cn(
            "px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0",
            canCommit
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : isDark
              ? "bg-white/10 text-neutral-500 cursor-not-allowed"
              : "bg-black/10 text-neutral-400 cursor-not-allowed"
          )}
          title={`Commit ${stagedCount} staged file${stagedCount !== 1 ? "s" : ""} (Cmd+Enter)`}
        >
          {commitLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Commit
        </button>
      </div>
    </div>
  );
}
