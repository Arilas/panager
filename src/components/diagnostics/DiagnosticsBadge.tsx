import type { ReactElement } from "react";
import { useEffect } from "react";
import { cn } from "../../lib/utils";
import { useDiagnosticsStore } from "../../stores/diagnostics";
import {
  getSeverityConfig,
  getSeverityLevel,
  getSeverityCount,
} from "../../hooks/useSeverity";
import type { ScopeDiagnosticsSummary } from "../../types";

type BadgeVariant = "default" | "compact" | "dot";

interface DiagnosticsBadgeProps {
  scopeId: string;
  variant?: BadgeVariant;
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

export function DiagnosticsBadge({
  scopeId,
  variant = "default",
  onClick,
  className,
}: DiagnosticsBadgeProps): ReactElement | null {
  const summary = useScopeSummary(scopeId);

  if (!summary || summary.totalCount === 0) {
    return null;
  }

  const severity = getSeverityLevel(summary);
  const styles = getSeverityConfig(severity);
  const Icon = styles.icon;
  const count = getSeverityCount(summary, severity);

  // Dot variant - minimal colored dot
  if (variant === "dot") {
    return (
      <div
        className={cn("h-1.5 w-1.5 rounded-full", styles.solidColor, className)}
        title={`${summary.totalCount} diagnostic issue${summary.totalCount !== 1 ? "s" : ""}`}
      />
    );
  }

  // Compact variant - small badge without click handler
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
          styles.bgColor,
          styles.textColor,
          className
        )}
        title={`${summary.totalCount} diagnostic issue${summary.totalCount !== 1 ? "s" : ""}`}
      >
        <Icon className="h-2.5 w-2.5" />
        <span>{count}</span>
      </div>
    );
  }

  // Default variant - full interactive badge
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

