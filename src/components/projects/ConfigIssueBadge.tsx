import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ConfigMismatch, SshRemoteMismatch } from "../../types";
import * as api from "../../lib/tauri";

interface ConfigIssueBadgeProps {
  projectId: string;
  onClick: () => void;
}

export function ConfigIssueBadge({ projectId, onClick }: ConfigIssueBadgeProps) {
  const [issues, setIssues] = useState<ConfigMismatch[]>([]);
  const [sshIssue, setSshIssue] = useState<SshRemoteMismatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkIssues = async () => {
      try {
        const [gitIssues, sshMismatch] = await Promise.all([
          api.verifyProjectGitConfig(projectId),
          api.verifyProjectSshRemote(projectId),
        ]);

        if (mounted) {
          setIssues(gitIssues);
          setSshIssue(sshMismatch);
        }
      } catch (error) {
        console.error("Failed to check config issues:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkIssues();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const totalIssues = issues.length + (sshIssue ? 1 : 0);

  if (loading) {
    return (
      <div className="p-1">
        <Loader2 className="h-3 w-3 text-muted-foreground/50 animate-spin" />
      </div>
    );
  }

  if (totalIssues === 0) {
    return null;
  }

  const getTooltip = () => {
    const parts: string[] = [];

    issues.forEach((issue) => {
      switch (issue.issueType) {
        case "git_name":
          parts.push(`Name: expected "${issue.expectedValue}", got "${issue.actualValue}"`);
          break;
        case "git_email":
          parts.push(`Email: expected "${issue.expectedValue}", got "${issue.actualValue}"`);
          break;
        case "git_gpg":
          parts.push(`GPG signing: expected ${issue.expectedValue}, got ${issue.actualValue}`);
          break;
      }
    });

    if (sshIssue) {
      parts.push(`SSH remote should use "${sshIssue.expectedAlias}" alias`);
    }

    return parts.join("\n");
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        "hover:bg-amber-500/20 transition-colors"
      )}
      title={getTooltip()}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {totalIssues}
    </button>
  );
}

// Exportable hook for getting issues
export function useConfigIssues(projectId: string) {
  const [issues, setIssues] = useState<ConfigMismatch[]>([]);
  const [sshIssue, setSshIssue] = useState<SshRemoteMismatch | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [gitIssues, sshMismatch] = await Promise.all([
        api.verifyProjectGitConfig(projectId),
        api.verifyProjectSshRemote(projectId),
      ]);
      setIssues(gitIssues);
      setSshIssue(sshMismatch);
    } catch (error) {
      console.error("Failed to check config issues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  return { issues, sshIssue, loading, refresh };
}
