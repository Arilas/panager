import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/Dialog";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useProjectsStore } from "../../stores/projects";
import type { ProjectFolderWarning, ScopeWithLinks } from "../../types";
import {
  AlertTriangle,
  FolderInput,
  Trash2,
  EyeOff,
  Loader2,
} from "lucide-react";

interface ScopeFolderWarningsProps {
  scope: ScopeWithLinks;
  warnings: ProjectFolderWarning[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScopeFolderWarnings({
  scope,
  warnings,
  open,
  onOpenChange,
}: ScopeFolderWarningsProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const { ignoreFolderWarning, moveProjectToScopeFolder } = useScopesStore();
  const { deleteProject } = useProjectsStore();

  const handleMove = async (warning: ProjectFolderWarning) => {
    setProcessingIds((prev) => new Set(prev).add(warning.projectId));
    try {
      await moveProjectToScopeFolder(warning.projectId);
    } catch (error) {
      console.error("Failed to move project:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(warning.projectId);
        return next;
      });
    }
  };

  const handleRemove = async (warning: ProjectFolderWarning) => {
    setProcessingIds((prev) => new Set(prev).add(warning.projectId));
    try {
      await deleteProject(warning.projectId);
    } catch (error) {
      console.error("Failed to remove project:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(warning.projectId);
        return next;
      });
    }
  };

  const handleIgnore = async (warning: ProjectFolderWarning) => {
    setProcessingIds((prev) => new Set(prev).add(warning.projectId));
    try {
      await ignoreFolderWarning(scope.scope.id, warning.projectPath);
    } catch (error) {
      console.error("Failed to ignore warning:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(warning.projectId);
        return next;
      });
    }
  };

  return (
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
                      {isProcessing && (
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleMove(warning)}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium",
                          "bg-primary/10 text-primary",
                          "hover:bg-primary/20 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <FolderInput className="h-3 w-3" />
                        Move
                      </button>
                      <button
                        onClick={() => handleRemove(warning)}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium",
                          "bg-red-500/10 text-red-500",
                          "hover:bg-red-500/20 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                      <button
                        onClick={() => handleIgnore(warning)}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium",
                          "bg-black/5 dark:bg-white/10 text-foreground/70",
                          "hover:bg-black/10 dark:hover:bg-white/15 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <EyeOff className="h-3 w-3" />
                        Ignore
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-black/5 dark:border-white/5">
          <p className="text-[11px] text-muted-foreground">
            <strong>Move:</strong> Physically moves the project folder into the
            scope folder.
            <br />
            <strong>Remove:</strong> Removes the project from this scope (files
            remain).
            <br />
            <strong>Ignore:</strong> Keep the project as-is without showing this
            warning.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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
