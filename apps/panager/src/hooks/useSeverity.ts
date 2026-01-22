import { useMemo } from "react";
import type { Severity } from "../types";
import type { ScopeDiagnosticsSummary } from "../types";
import {
  SEVERITY_CONFIG,
  getSeverityConfig,
  type SeverityConfig,
} from "../components/common/Severity";

export { SEVERITY_CONFIG, getSeverityConfig, type SeverityConfig };

export function useSeverityStyles(severity: Severity): SeverityConfig {
  return useMemo(() => SEVERITY_CONFIG[severity], [severity]);
}

export function getSeverityLevel(
  summary: ScopeDiagnosticsSummary
): "error" | "warning" | "info" {
  if (summary.errorCount > 0) return "error";
  if (summary.warningCount > 0) return "warning";
  return "info";
}

export function getSeverityCount(
  summary: ScopeDiagnosticsSummary,
  severity: "error" | "warning" | "info"
): number {
  switch (severity) {
    case "error":
      return summary.errorCount;
    case "warning":
      return summary.warningCount;
    case "info":
      return summary.infoCount;
  }
}
