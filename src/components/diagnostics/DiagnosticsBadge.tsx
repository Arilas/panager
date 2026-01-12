import type { ReactElement } from "react";
import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { useDiagnosticsStore } from "../../stores/diagnostics";
import type { ScopeDiagnosticsSummary } from "../../types";

interface DiagnosticsBadgeProps {
  scopeId: string;
  onClick?: () => void;
  className?: string;
}

function useScopeSummary(scopeId: string): ScopeDiagnosticsSummary | undefined {
  const { summaries, fetchScopeSummary } = useDiagnosticsStore();

  useEffect(() => {
    fetchScopeSummary(scopeId);
  }, [scopeId, fetchScopeSummary]);

  return summaries.get(scopeId);
}

function getSeverityLevel(summary: ScopeDiagnosticsSummary): "error" | "warning" | "info" {
  if (summary.errorCount > 0) return "error";
  if (summary.warningCount > 0) return "warning";
  return "info";
}

const severityStyles = {
  error: {
    icon: AlertCircle,
    bgColor: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    hoverColor: "hover:bg-red-500/20",
    solidColor: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    hoverColor: "hover:bg-amber-500/20",
    solidColor: "bg-amber-500",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    hoverColor: "hover:bg-blue-500/20",
    solidColor: "bg-blue-500",
  },
} as const;

function getSeverityCount(summary: ScopeDiagnosticsSummary, severity: "error" | "warning" | "info"): number {
  switch (severity) {
    case "error":
      return summary.errorCount;
    case "warning":
      return summary.warningCount;
    case "info":
      return summary.infoCount;
  }
}

export function DiagnosticsBadge({
  scopeId,
  onClick,
  className,
}: DiagnosticsBadgeProps): ReactElement | null {
  const summary = useScopeSummary(scopeId);

  if (!summary || summary.totalCount === 0) {
    return null;
  }

  const severity = getSeverityLevel(summary);
  const styles = severityStyles[severity];
  const Icon = styles.icon;
  const count = getSeverityCount(summary, severity);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
        styles.bgColor,
        styles.textColor,
        styles.hoverColor,
        className
      )}
      title={`View ${summary.totalCount} diagnostic issue${summary.totalCount !== 1 ? "s" : ""}`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{count}</span>
    </button>
  );
}

/**
 * A minimal badge that just shows a colored dot.
 * Useful for compact displays like list items.
 */
export function DiagnosticsBadgeCompact({
  scopeId,
  className,
}: {
  scopeId: string;
  className?: string;
}): ReactElement | null {
  const summary = useScopeSummary(scopeId);

  if (!summary || summary.totalCount === 0) {
    return null;
  }

  const severity = getSeverityLevel(summary);

  return (
    <div
      className={cn("h-1.5 w-1.5 rounded-full", severityStyles[severity].solidColor, className)}
      title={`${summary.totalCount} diagnostic issue${summary.totalCount !== 1 ? "s" : ""}`}
    />
  );
}
