/**
 * Approval Banner - Shows pending approvals count with batch actions
 *
 * Displays when there are pending file changes awaiting approval.
 */

import { AlertTriangle, Check, X, Settings2 } from "lucide-react";
import { useAgentStore } from "../../stores/agent";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import { ApprovalModeLabels } from "../../types/acp";

interface ApprovalBannerProps {
  onApproveAll?: () => void;
  onRejectAll?: () => void;
  onOpenSettings?: () => void;
}

export function ApprovalBanner({
  onApproveAll,
  onRejectAll,
  onOpenSettings,
}: ApprovalBannerProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const approvalMode = useAgentStore((s) => s.approvalMode);

  // Count pending approvals
  const pendingCount = pendingApprovals.filter((a) => a.status === "pending").length;

  if (pendingCount === 0) {
    return null;
  }

  const handleApproveAll = () => {
    // Mark all as approved
    pendingApprovals.forEach((approval) => {
      if (approval.status === "pending") {
        useAgentStore.getState().updateApprovalStatus(approval.id, "approved");
      }
    });
    onApproveAll?.();
  };

  const handleRejectAll = () => {
    // Mark all as rejected
    pendingApprovals.forEach((approval) => {
      if (approval.status === "pending") {
        useAgentStore.getState().updateApprovalStatus(approval.id, "rejected");
      }
    });
    onRejectAll?.();
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 gap-3",
        "rounded-lg",
        isDark
          ? "bg-amber-500/10 border border-amber-500/20"
          : "bg-amber-50 border border-amber-200"
      )}
    >
      {/* Info */}
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className={cn("text-sm", isDark ? "text-white" : "text-neutral-900")}>
          {pendingCount} pending {pendingCount === 1 ? "change" : "changes"}
        </span>
        <span className={cn("text-xs", isDark ? "text-neutral-400" : "text-neutral-500")}>
          ({ApprovalModeLabels[approvalMode]} mode)
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Batch actions (only in batch mode or when there are multiple) */}
        {(approvalMode === "batch" || pendingCount > 1) && (
          <>
            <button
              onClick={handleRejectAll}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                "text-red-500 hover:bg-red-500/10"
              )}
              title="Reject all changes"
            >
              <X className="w-3 h-3" />
              Reject All
            </button>
            <button
              onClick={handleApproveAll}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                "text-green-500 hover:bg-green-500/10"
              )}
              title="Approve all changes"
            >
              <Check className="w-3 h-3" />
              Approve All
            </button>
          </>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            isDark
              ? "text-neutral-400 hover:text-white hover:bg-white/10"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
          )}
          title="Approval settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
