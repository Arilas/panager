import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/Dialog";
import { ResolveFolderWarningDialog } from "./ResolveFolderWarningDialog";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import type { ProjectFolderWarning, ScopeWithLinks } from "../../types";
import { AlertTriangle, Wrench, Loader2 } from "lucide-react";

interface ScopeFolderWarningsProps {
  scope: ScopeWithLinks;
  warnings: ProjectFolderWarning[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveToScope?: (projectId: string, targetScopeId: string) => void;
}

export function ScopeFolderWarnings({
  scope,
  warnings,
  open,
  onOpenChange,
  onMoveToScope,
}: ScopeFolderWarningsProps) {
  const [warningToResolve, setWarningToResolve] = useState<ProjectFolderWarning | null>(null);
  const [processingIds] = useState<Set<string>>(new Set());

  const { scopes } = useScopesStore();
  const otherScopes = scopes.filter((s) => s.scope.id !== scope.scope.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Projects Outside Scope Folder
            </DialogTitle>
            <DialogDescription>
              These projects are not located in the scope's default folder:{" "}
              <code className="text-[11px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                {scope.scope.defaultFolder}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {warnings.length === 0 ? (
              <div className="text-center py-8">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-[13px] text-foreground/70">
                  All projects are in the scope folder
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((warning) => {
                  const isProcessing = processingIds.has(warning.projectId);
                  return (
                    <div
                      key={warning.projectId}
                      className={cn(
                        "p-3 rounded-lg",
                        "bg-black/[0.02] dark:bg-white/[0.02]",
                        "border border-black/5 dark:border-white/5",
                        isProcessing && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground/90 truncate">
                            {warning.projectName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {warning.projectPath}
                          </p>
                        </div>
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                        ) : (
                          <button
                            onClick={() => setWarningToResolve(warning)}
                            disabled={isProcessing}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium shrink-0",
                              "bg-primary/10 text-primary",
                              "hover:bg-primary/20 transition-colors",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            <Wrench className="h-3 w-3" />
                            Solve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5">
            <p className="text-[11px] text-muted-foreground">
              Click <strong>Solve</strong> to choose how to handle each project:
              move it to the scope folder, transfer to another scope, remove, or ignore.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ResolveFolderWarningDialog
        warning={warningToResolve}
        scope={scope}
        otherScopes={otherScopes}
        open={!!warningToResolve}
        onOpenChange={(open) => !open && setWarningToResolve(null)}
        onMoveToScope={onMoveToScope}
      />
    </>
  );
}

// Small indicator badge for showing warnings exist
interface FolderWarningBadgeProps {
  warningCount: number;
  onClick: () => void;
}

export function FolderWarningBadge({
  warningCount,
  onClick,
}: FolderWarningBadgeProps) {
  if (warningCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium",
        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        "hover:bg-amber-500/20 transition-colors"
      )}
      title={`${warningCount} project${warningCount !== 1 ? "s" : ""} outside scope folder`}
    >
      <AlertTriangle className="h-3 w-3" />
      {warningCount}
    </button>
  );
}
