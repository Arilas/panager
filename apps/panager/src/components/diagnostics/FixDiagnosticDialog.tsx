import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { SelectableOptionCard } from "../ui/SelectableOptionCard";
import { useDiagnosticsStore } from "../../stores/diagnostics";
import { useProjectsStore } from "../../stores/projects";
import { useEditorsStore } from "../../stores/editors";
import { useScopesStore } from "../../stores/scopes";
import { openInEditor } from "../../lib/tauri";
import type { DiagnosticIssue, DiagnosticFix, JsonValue } from "../../types";
import {
  Wrench,
  User,
  Mail,
  ShieldCheck,
  Key,
  FolderInput,
  EyeOff,
  ExternalLink,
  GitPullRequest,
  GitBranch,
} from "lucide-react";

interface FixDiagnosticDialogProps {
  issue: DiagnosticIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FixOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fixType: string;
  params?: Record<string, unknown>;
}

function getFixOptionsForIssue(issue: DiagnosticIssue | null): FixOption[] {
  if (!issue) return [];

  switch (issue.ruleId) {
    case "git/identity-mismatch": {
      const options: FixOption[] = [];
      if (issue.expectedValue && issue.title.includes("user.name")) {
        options.push({
          id: "apply_name",
          title: "Apply expected user.name",
          description: `Set git user.name to "${issue.expectedValue}"`,
          icon: <User className="h-4 w-4" />,
          fixType: "apply_name",
        });
      }
      if (issue.expectedValue && issue.title.includes("user.email")) {
        options.push({
          id: "apply_email",
          title: "Apply expected user.email",
          description: `Set git user.email to "${issue.expectedValue}"`,
          icon: <Mail className="h-4 w-4" />,
          fixType: "apply_email",
        });
      }
      return options;
    }

    case "git/gpg-mismatch": {
      const options: FixOption[] = [];

      // If project explicitly disabled GPG when scope expects it enabled
      if (
        issue.expectedValue === "enabled" &&
        issue.actualValue === "disabled"
      ) {
        options.push({
          id: "remove_gpg",
          title: "Remove explicit GPG setting",
          description:
            "Remove the local gpgsign override to inherit from scope config",
          icon: <ShieldCheck className="h-4 w-4" />,
          fixType: "remove_gpg",
        });
      }

      // If project has different signing key
      if (issue.title.includes("signing key")) {
        options.push({
          id: "apply_gpg",
          title: "Apply scope's signing key",
          description: `Change signing key to "${issue.expectedValue}"`,
          icon: <Key className="h-4 w-4" />,
          fixType: "apply_gpg",
        });
      }

      // Fallback for other cases
      if (options.length === 0) {
        options.push({
          id: "apply_gpg",
          title: "Apply expected GPG config",
          description: `Set commit.gpgsign to "${issue.expectedValue}"`,
          icon: <ShieldCheck className="h-4 w-4" />,
          fixType: "apply_gpg",
        });
      }

      return options;
    }

    case "git/ssh-remote-mismatch":
      return [
        {
          id: "update_remote",
          title: "Update remote URL",
          description: "Change remote to use the scope's SSH alias",
          icon: <Key className="h-4 w-4" />,
          fixType: "update_remote",
        },
      ];

    case "project/outside-folder":
      return [
        {
          id: "move_to_folder",
          title: "Move to scope folder",
          description:
            "Physically move the project to the scope's default folder",
          icon: <FolderInput className="h-4 w-4" />,
          fixType: "move_to_folder",
        },
      ];

    case "repo/unpushed-commits":
      return [
        {
          id: "push_changes",
          title: "Push changes",
          description: "Push local commits to the remote repository",
          icon: <GitPullRequest className="h-4 w-4" />,
          fixType: "push_changes",
        },
        {
          id: "open_editor",
          title: "Open in editor",
          description: "Open the project in your editor to review changes",
          icon: <ExternalLink className="h-4 w-4" />,
          fixType: "open_editor",
        },
      ];

    case "repo/detached-head":
      return [
        {
          id: "checkout_main",
          title: "Checkout main branch",
          description: "Switch back to the main branch",
          icon: <GitBranch className="h-4 w-4" />,
          fixType: "checkout_main",
        },
      ];

    default:
      return [];
  }
}

export function FixDiagnosticDialog({
  issue,
  open,
  onOpenChange,
}: FixDiagnosticDialogProps) {
  const [selectedFix, setSelectedFix] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { fixIssue, dismissIssue } = useDiagnosticsStore();
  const { allProjects } = useProjectsStore();
  const { editors, getDefaultEditor } = useEditorsStore();
  const { scopes } = useScopesStore();

  const project = issue?.projectId
    ? allProjects.find((p) => p.project.id === issue.projectId)
    : null;

  const scope = issue?.scopeId
    ? scopes.find((s) => s.scope.id === issue.scopeId)
    : null;

  /** Determine editor: project preferred > scope default > global default */
  function getEditorForProject() {
    const projectEditorId = project?.project.preferredEditorId;
    const scopeEditorId = scope?.scope.defaultEditorId;
    const preferredId = projectEditorId ?? scopeEditorId;

    if (preferredId) {
      const editor = editors.find((e) => e.id === preferredId);
      if (editor) return editor;
    }
    return getDefaultEditor();
  }

  const fixOptions = useMemo(() => getFixOptionsForIssue(issue), [issue]);

  // Reset selected fix when dialog opens with new issue
  useEffect(() => {
    if (open && fixOptions.length > 0) {
      setSelectedFix(fixOptions[0].id);
    } else if (!open) {
      setSelectedFix(null);
    }
  }, [open, fixOptions]);

  const handleApplyFix = async () => {
    if (!issue || !selectedFix) return;

    const option = fixOptions.find((o) => o.id === selectedFix);
    if (!option) return;

    setLoading(true);
    try {
      // Handle open_editor client-side - don't call backend, just open and close dialog
      if (option.fixType === "open_editor") {
        const editor = getEditorForProject();
        if (project && editor) {
          await openInEditor(editor.command, project.project.path);
        }
        onOpenChange(false);
        return;
      }

      const fix: DiagnosticFix = {
        issueId: issue.id,
        ruleId: issue.ruleId,
        fixType: option.fixType,
        params: (option.params as JsonValue) || null,
      };

      await fixIssue(fix, issue.scopeId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply fix:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!issue) return;

    setLoading(true);
    try {
      await dismissIssue(issue.id, issue.scopeId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to dismiss:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!issue) return null;

  const hasFixOptions = fixOptions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Fix Issue</DialogTitle>
              <DialogDescription>{issue.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {/* Issue Details */}
          <div className="mb-4 p-3 rounded-lg bg-black/2 dark:bg-white/2 border border-black/5 dark:border-white/5">
            <p className="text-[12px] text-muted-foreground">
              {issue.description}
            </p>
            {project && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Project: {project.project.name}
              </p>
            )}
          </div>

          {/* Fix Options */}
          {hasFixOptions ? (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground/70 mb-2">
                Choose a fix:
              </p>
              {fixOptions.map((option) => (
                <SelectableOptionCard
                  key={option.id}
                  selected={selectedFix === option.id}
                  onClick={() => setSelectedFix(option.id)}
                  icon={option.icon}
                  title={option.title}
                  description={option.description}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[12px] text-muted-foreground">
                No automatic fix is available for this issue.
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                You can dismiss this issue if it's not relevant.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={loading}
            >
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              Dismiss
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="glass" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {hasFixOptions && (
                <Button
                  onClick={handleApplyFix}
                  loading={loading}
                  disabled={!selectedFix}
                  variant="glass-scope"
                >
                  Apply Fix
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
