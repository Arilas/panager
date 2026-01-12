import type { ReactElement } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import type { DiagnosticIssue, Severity } from "../../types";
import { useDiagnosticsStore } from "../../stores/diagnostics";
import { useProjectsStore } from "../../stores/projects";

interface DiagnosticsIssueCardProps {
  issue: DiagnosticIssue;
  onFix?: (issue: DiagnosticIssue) => void;
  showProject?: boolean;
}

const severityConfig: Record<Severity, {
  icon: typeof AlertCircle;
  borderStyle: string;
  iconStyle: string;
  textColor: string;
  badgeStyle: string;
}> = {
  error: {
    icon: AlertCircle,
    borderStyle: "border-red-500/20",
    iconStyle: "bg-red-500/10 text-red-600 dark:text-red-400",
    textColor: "text-red-600 dark:text-red-400",
    badgeStyle: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    borderStyle: "border-amber-500/20",
    iconStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    borderStyle: "border-blue-500/20",
    iconStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
};

function getSeverityConfig(severity: Severity) {
  return severityConfig[severity];
}

export function DiagnosticsIssueCard({
  issue,
  onFix,
  showProject = true,
}: DiagnosticsIssueCardProps): ReactElement {
  const { dismissIssue, undismissIssue, getRuleMetadataById } = useDiagnosticsStore();
  const { allProjects } = useProjectsStore();

  const ruleMeta = getRuleMetadataById(issue.ruleId);
  const project = issue.projectId
    ? allProjects.find((p) => p.project.id === issue.projectId)
    : null;

  const config = getSeverityConfig(issue.severity);
  const dismissedIconStyle = "bg-black/5 dark:bg-white/10 text-muted-foreground";

  async function handleDismiss(): Promise<void> {
    if (issue.dismissed) {
      await undismissIssue(issue.id, issue.scopeId);
    } else {
      await dismissIssue(issue.id, issue.scopeId);
    }
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        issue.dismissed
          ? "border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] opacity-60"
          : config.borderStyle,
        !issue.dismissed && "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
            issue.dismissed ? dismissedIconStyle : config.iconStyle
          )}
        >
          <SeverityIcon severity={issue.severity} className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-[13px] font-medium text-foreground/90">
                  {issue.title}
                </h4>
                {issue.dismissed && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground">
                    Dismissed
                  </span>
                )}
              </div>
              {showProject && project && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  in {project.project.name}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDismiss}
                title={issue.dismissed ? "Undismiss" : "Dismiss"}
              >
                {issue.dismissed ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
              {onFix && !issue.dismissed && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onFix(issue)}
                  title="Fix Issue"
                >
                  <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-1.5">
            {issue.description}
          </p>

          {(issue.expectedValue || issue.actualValue) && !issue.dismissed && (
            <div className="mt-2 space-y-1">
              {issue.expectedValue && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground shrink-0">Expected:</span>
                  <code className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono truncate">
                    {issue.expectedValue}
                  </code>
                </div>
              )}
              {issue.actualValue && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground shrink-0">Actual:</span>
                  <code className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono truncate">
                    {issue.actualValue}
                  </code>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <code className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground font-mono">
              {issue.ruleId}
            </code>
            {ruleMeta?.requiredFeature && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                Requires Max
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A compact version of the issue card for list views.
 */
export function DiagnosticsIssueCardCompact({
  issue,
  onClick,
}: {
  issue: DiagnosticIssue;
  onClick?: () => void;
}): ReactElement {
  const { allProjects } = useProjectsStore();
  const project = issue.projectId
    ? allProjects.find((p) => p.project.id === issue.projectId)
    : null;

  const config = getSeverityConfig(issue.severity);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-2.5 text-left rounded-lg transition-colors",
        "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]",
        "border border-transparent",
        !issue.dismissed && config.borderStyle
      )}
    >
      <div className="flex items-center gap-2.5">
        <SeverityIcon
          severity={issue.severity}
          className={cn("h-3.5 w-3.5 shrink-0", config.textColor)}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground/90 truncate">
            {issue.title}
          </p>
          {project && (
            <p className="text-[10px] text-muted-foreground truncate">
              {project.project.name}
            </p>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    </button>
  );
}

export function SeverityIcon({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}): ReactElement {
  const Icon = getSeverityConfig(severity).icon;
  return <Icon className={className} />;
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}): ReactElement {
  const config = getSeverityConfig(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        config.badgeStyle,
        className
      )}
    >
      <SeverityIcon severity={severity} className="h-2.5 w-2.5" />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
