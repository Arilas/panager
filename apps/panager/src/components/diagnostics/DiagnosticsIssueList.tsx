import type { ReactElement } from "react";
import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Info, GitBranch, Folder, Shield, Activity } from "lucide-react";
import { cn } from "../../lib/utils";
import { DiagnosticsIssueCard } from "./DiagnosticsIssueCard";
import type { DiagnosticIssue, RuleGroup, Severity } from "../../types";

interface DiagnosticsIssueListProps {
  issues: DiagnosticIssue[];
  groupBy?: "severity" | "group" | "project" | "none";
  showDismissed?: boolean;
  onFixIssue?: (issue: DiagnosticIssue) => void;
}

interface GroupInfo {
  icon: ReactElement;
  label: string;
  color: string;
}

const severityGroups: Record<Severity, GroupInfo> = {
  error: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    label: "Errors",
    color: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: "Warnings",
    color: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: <Info className="h-3.5 w-3.5" />,
    label: "Info",
    color: "text-blue-600 dark:text-blue-400",
  },
};

const ruleGroups: Record<RuleGroup, GroupInfo> = {
  git: {
    icon: <GitBranch className="h-3.5 w-3.5" />,
    label: "Git Configuration",
    color: "text-orange-600 dark:text-orange-400",
  },
  repo: {
    icon: <Activity className="h-3.5 w-3.5" />,
    label: "Repository Health",
    color: "text-purple-600 dark:text-purple-400",
  },
  project: {
    icon: <Folder className="h-3.5 w-3.5" />,
    label: "Project Structure",
    color: "text-cyan-600 dark:text-cyan-400",
  },
  security: {
    icon: <Shield className="h-3.5 w-3.5" />,
    label: "Security",
    color: "text-red-600 dark:text-red-400",
  },
};

function getGroupInfo(groupKey: string, groupBy: string): GroupInfo {
  if (groupBy === "severity" && groupKey in severityGroups) {
    return severityGroups[groupKey as Severity];
  }
  if (groupBy === "group" && groupKey in ruleGroups) {
    return ruleGroups[groupKey as RuleGroup];
  }
  if (groupBy === "group") {
    return {
      icon: <Info className="h-3.5 w-3.5" />,
      label: groupKey.charAt(0).toUpperCase() + groupKey.slice(1),
      color: "text-muted-foreground",
    };
  }
  if (groupBy === "project") {
    return {
      icon: <Folder className="h-3.5 w-3.5" />,
      label: groupKey === "scope" ? "Scope-level Issues" : "Project Issues",
      color: "text-muted-foreground",
    };
  }
  return { icon: <></>, label: "Issues", color: "text-muted-foreground" };
}

const severityOrder: Severity[] = ["error", "warning", "info"];
const ruleGroupOrder: RuleGroup[] = ["git", "repo", "project", "security"];

function sortGroupKeys(keys: string[], groupBy: string): string[] {
  if (groupBy === "severity") {
    return severityOrder.filter((s) => keys.includes(s));
  }
  if (groupBy === "group") {
    const orderedKeys = ruleGroupOrder.filter((g) => keys.includes(g));
    const remainingKeys = keys.filter((k) => !ruleGroupOrder.includes(k as RuleGroup));
    return [...orderedKeys, ...remainingKeys];
  }
  return keys;
}

export function DiagnosticsIssueList({
  issues,
  groupBy = "severity",
  showDismissed = false,
  onFixIssue,
}: DiagnosticsIssueListProps): ReactElement {
  const filteredIssues = useMemo(() => {
    return showDismissed ? issues : issues.filter((issue) => !issue.dismissed);
  }, [issues, showDismissed]);

  const groupedIssues = useMemo(() => {
    if (groupBy === "none") {
      return new Map([["all", filteredIssues]]);
    }

    const groups = new Map<string, DiagnosticIssue[]>();

    for (const issue of filteredIssues) {
      let key: string;
      switch (groupBy) {
        case "severity":
          key = issue.severity;
          break;
        case "group":
          key = issue.ruleId.split("/")[0] || "other";
          break;
        case "project":
          key = issue.projectId || "scope";
          break;
        default:
          key = "all";
      }

      const group = groups.get(key);
      if (group) {
        group.push(issue);
      } else {
        groups.set(key, [issue]);
      }
    }

    const sortedKeys = sortGroupKeys(Array.from(groups.keys()), groupBy);
    const sortedGroups = new Map<string, DiagnosticIssue[]>();
    for (const key of sortedKeys) {
      const group = groups.get(key);
      if (group && group.length > 0) {
        sortedGroups.set(key, group);
      }
    }

    return sortedGroups;
  }, [filteredIssues, groupBy]);

  if (filteredIssues.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-6 w-6 text-green-500" />
        </div>
        <p className="text-[13px] font-medium text-foreground/80">No issues found</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {showDismissed
            ? "There are no diagnostic issues for this scope"
            : "All issues have been resolved or dismissed"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(groupedIssues.entries()).map(([groupKey, groupIssues]) => {
        const showHeader = groupBy !== "none";
        const info = getGroupInfo(groupKey, groupBy);

        return (
          <div key={groupKey}>
            {showHeader && (
              <div className="flex items-center gap-2 mb-2">
                <span className={info.color}>{info.icon}</span>
                <h3 className={cn("text-[12px] font-medium", info.color)}>{info.label}</h3>
                <span className="text-[11px] text-muted-foreground">({groupIssues.length})</span>
              </div>
            )}
            <div className="space-y-2">
              {groupIssues.map((issue) => (
                <DiagnosticsIssueCard
                  key={issue.id}
                  issue={issue}
                  onFix={onFixIssue}
                  showProject={groupBy !== "project"}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
