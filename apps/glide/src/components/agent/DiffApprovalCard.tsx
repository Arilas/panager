/**
 * Diff Approval Card - Inline diff view with accept/reject controls
 *
 * Displays a file diff with approval buttons for the file edit workflow.
 */

import { Check, X, Expand, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useAgentStore } from "../../stores/agent";
import { useEditorStore } from "../../stores/editor";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { PendingApproval, DiffLine } from "../../types/acp";

interface DiffApprovalCardProps {
  approval: PendingApproval;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}

export function DiffApprovalCard({ approval, onApprove, onReject }: DiffApprovalCardProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const [isExpanded, setIsExpanded] = useState(true);
  const updateApprovalStatus = useAgentStore((s) => s.updateApprovalStatus);
  const openDiffTab = useEditorStore((s) => s.openDiffTab);

  const handleApprove = () => {
    updateApprovalStatus(approval.id, "approved");
    onApprove?.(approval.id);
  };

  const handleReject = () => {
    updateApprovalStatus(approval.id, "rejected");
    onReject?.(approval.id);
  };

  const handleOpenInEditor = () => {
    // Get file extension for language detection
    const fileName = approval.filePath.split("/").pop() || approval.filePath;
    const ext = fileName.split(".").pop() || "";
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescriptreact",
      js: "javascript",
      jsx: "javascriptreact",
      json: "json",
      css: "css",
      scss: "scss",
      html: "html",
      md: "markdown",
      py: "python",
      rs: "rust",
      go: "go",
    };
    const language = languageMap[ext] || "plaintext";

    // Open the diff in a full editor tab
    openDiffTab({
      type: "diff",
      path: approval.filePath,
      filePath: approval.filePath,
      fileName,
      originalContent: approval.diff.oldText,
      modifiedContent: approval.diff.newText,
      staged: false,
      language,
    });
  };

  // Flatten all hunks into lines for display
  const allLines: DiffLine[] = approval.diff.hunks?.flatMap((hunk) => hunk.lines) || [];

  // Calculate stats
  const additions = allLines.filter((l) => l.type === "add").length;
  const deletions = allLines.filter((l) => l.type === "delete").length;

  const isPending = approval.status === "pending";

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        isPending
          ? isDark
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-amber-500/30 bg-amber-50"
          : isDark
            ? "border-white/10 bg-white/5"
            : "border-black/10 bg-black/5",
        approval.status === "approved" && "opacity-60",
        approval.status === "rejected" && "opacity-40"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          "border-b",
          isDark ? "border-white/10" : "border-black/10"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-0.5 rounded transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-black/5"
            )}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <span
            className={cn(
              "font-mono text-sm truncate",
              isDark ? "text-white" : "text-neutral-900"
            )}
            title={approval.filePath}
          >
            {approval.filePath}
          </span>
          <span className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="text-green-500">+{additions}</span>
            <span className="text-red-500">-{deletions}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Open in editor button */}
          <button
            onClick={handleOpenInEditor}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/10"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
            )}
            title="Open in editor"
          >
            <Expand className="w-4 h-4" />
          </button>

          {/* Approval buttons (only for pending) */}
          {isPending && (
            <>
              <button
                onClick={handleReject}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  "text-red-500 hover:bg-red-500/10"
                )}
                title="Reject change"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleApprove}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  "text-green-500 hover:bg-green-500/10"
                )}
                title="Approve change"
              >
                <Check className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Status badge for non-pending */}
          {!isPending && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                approval.status === "approved"
                  ? "bg-green-500/20 text-green-500"
                  : "bg-red-500/20 text-red-500"
              )}
            >
              {approval.status}
            </span>
          )}
        </div>
      </div>

      {/* Diff content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <div className="font-mono text-xs leading-5">
            {allLines.length > 0 ? (
              allLines.map((line, index) => (
                <DiffLineRow key={index} line={line} isDark={isDark} />
              ))
            ) : (
              <div className={cn("p-3", isDark ? "text-neutral-400" : "text-neutral-500")}>
                No diff content available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single diff line row
 */
function DiffLineRow({ line, isDark }: { line: DiffLine; isDark: boolean }) {
  const bgColor =
    line.type === "add"
      ? isDark
        ? "bg-green-500/10"
        : "bg-green-50"
      : line.type === "delete"
        ? isDark
          ? "bg-red-500/10"
          : "bg-red-50"
        : "";

  const textColor =
    line.type === "add"
      ? "text-green-600 dark:text-green-400"
      : line.type === "delete"
        ? "text-red-600 dark:text-red-400"
        : isDark
          ? "text-neutral-300"
          : "text-neutral-600";

  const prefix =
    line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";

  return (
    <div className={cn("flex", bgColor)}>
      {/* Line numbers */}
      <div
        className={cn(
          "w-8 text-right pr-2 select-none shrink-0",
          isDark ? "text-neutral-500" : "text-neutral-400",
          "border-r",
          isDark ? "border-white/5" : "border-black/5"
        )}
      >
        {line.oldLineNumber ?? ""}
      </div>
      <div
        className={cn(
          "w-8 text-right pr-2 select-none shrink-0",
          isDark ? "text-neutral-500" : "text-neutral-400",
          "border-r",
          isDark ? "border-white/5" : "border-black/5"
        )}
      >
        {line.newLineNumber ?? ""}
      </div>

      {/* Prefix and content */}
      <div className={cn("flex-1 px-2 whitespace-pre", textColor)}>
        <span className="select-none">{prefix}</span>
        {line.content}
      </div>
    </div>
  );
}
