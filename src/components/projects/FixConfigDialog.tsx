import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { ConfigMismatch, SshRemoteMismatch, ProjectWithStatus } from "../../types";
import * as api from "../../lib/tauri";
import {
  AlertTriangle,
  User,
  Mail,
  ShieldCheck,
  Key,
  Check,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface FixConfigDialogProps {
  project: ProjectWithStatus;
  issues: ConfigMismatch[];
  sshIssue: SshRemoteMismatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFixed?: () => void;
}

export function FixConfigDialog({
  project,
  issues,
  sshIssue,
  open,
  onOpenChange,
  onFixed,
}: FixConfigDialogProps) {
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const getIssueIcon = (type: string) => {
    switch (type) {
      case "git_name":
        return User;
      case "git_email":
        return Mail;
      case "git_gpg":
        return ShieldCheck;
      case "ssh_remote":
        return Key;
      default:
        return AlertTriangle;
    }
  };

  const getIssueLabel = (type: string) => {
    switch (type) {
      case "git_name":
        return "Git User Name";
      case "git_email":
        return "Git User Email";
      case "git_gpg":
        return "GPG Signing";
      case "ssh_remote":
        return "SSH Remote";
      default:
        return type;
    }
  };

  const handleFixGitIssue = async (issue: ConfigMismatch) => {
    if (!issue.expectedValue) return;

    const key = issue.issueType;
    setFixingIds((prev) => new Set(prev).add(key));
    setError(null);

    try {
      const configKey =
        issue.issueType === "git_name"
          ? "user.name"
          : issue.issueType === "git_email"
            ? "user.email"
            : "commit.gpgsign";

      await api.fixProjectGitConfig(project.project.id, configKey, issue.expectedValue);
      setFixedIds((prev) => new Set(prev).add(key));
    } catch (err) {
      setError(String(err));
    } finally {
      setFixingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleFixSshRemote = async () => {
    setFixingIds((prev) => new Set(prev).add("ssh_remote"));
    setError(null);

    try {
      await api.fixProjectSshRemote(project.project.id);
      setFixedIds((prev) => new Set(prev).add("ssh_remote"));
    } catch (err) {
      setError(String(err));
    } finally {
      setFixingIds((prev) => {
        const next = new Set(prev);
        next.delete("ssh_remote");
        return next;
      });
    }
  };

  const handleFixAll = async () => {
    for (const issue of issues) {
      if (!fixedIds.has(issue.issueType) && issue.expectedValue) {
        await handleFixGitIssue(issue);
      }
    }
    if (sshIssue && !fixedIds.has("ssh_remote")) {
      await handleFixSshRemote();
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (fixedIds.size > 0) {
        onFixed?.();
      }
      setFixedIds(new Set());
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const totalIssues = issues.length + (sshIssue ? 1 : 0);
  const allFixed = fixedIds.size === totalIssues;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Configuration Issues
          </DialogTitle>
          <DialogDescription>
            Fix configuration mismatches for{" "}
            <span className="font-medium">{project.project.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-[12px] text-red-500">{error}</p>
            </div>
          )}

          {issues.map((issue) => {
            const Icon = getIssueIcon(issue.issueType);
            const isFixing = fixingIds.has(issue.issueType);
            const isFixed = fixedIds.has(issue.issueType);

            return (
              <div
                key={issue.issueType}
                className={cn(
                  "p-3 rounded-lg",
                  "bg-black/[0.02] dark:bg-white/[0.02]",
                  "border border-black/5 dark:border-white/5",
                  isFixed && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-md",
                        isFixed
                          ? "bg-green-500/10 text-green-500"
                          : "bg-amber-500/10 text-amber-500"
                      )}
                    >
                      {isFixed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground/90">
                        {getIssueLabel(issue.issueType)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="text-red-500/80 line-through truncate max-w-[120px]">
                          {issue.actualValue || "(not set)"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-green-500/80 truncate max-w-[120px]">
                          {issue.expectedValue || "(not set)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isFixed && issue.expectedValue && (
                    <button
                      onClick={() => handleFixGitIssue(issue)}
                      disabled={isFixing}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-[11px] font-medium",
                        "bg-primary/10 text-primary",
                        "hover:bg-primary/20 transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isFixing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Fix"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {sshIssue && (
            <div
              className={cn(
                "p-3 rounded-lg",
                "bg-black/[0.02] dark:bg-white/[0.02]",
                "border border-black/5 dark:border-white/5",
                fixedIds.has("ssh_remote") && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-md",
                      fixedIds.has("ssh_remote")
                        ? "bg-green-500/10 text-green-500"
                        : "bg-amber-500/10 text-amber-500"
                    )}
                  >
                    {fixedIds.has("ssh_remote") ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground/90">
                      SSH Remote URL
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Should use <span className="font-mono">{sshIssue.expectedAlias}</span>{" "}
                      alias
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[300px]">
                      Current: {sshIssue.actualUrl}
                    </p>
                  </div>
                </div>

                {!fixedIds.has("ssh_remote") && (
                  <button
                    onClick={handleFixSshRemote}
                    disabled={fixingIds.has("ssh_remote")}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md text-[11px] font-medium",
                      "bg-primary/10 text-primary",
                      "hover:bg-primary/20 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {fixingIds.has("ssh_remote") ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Fix"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button
            variant="secondary"
            onClick={() => handleClose(false)}
          >
            {allFixed ? "Done" : "Close"}
          </Button>
          {!allFixed && totalIssues > 1 && (
            <Button
              onClick={handleFixAll}
              disabled={fixingIds.size > 0}
            >
              Fix All
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
