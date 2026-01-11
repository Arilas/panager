import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { cn } from "../../lib/utils";
import { useProjectsStore } from "../../stores/projects";
import { useState } from "react";
import type { ProjectWithStatus } from "../../types";
import { AlertTriangle, Folder } from "lucide-react";

interface DeleteProjectDialogProps {
  project: ProjectWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const { deleteProjectWithFolder } = useProjectsStore();

  const handleDelete = async () => {
    if (!project) return;

    setLoading(true);
    try {
      await deleteProjectWithFolder(project.project.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayPath = project?.project.path
    .replace(/^\/Users\/[^/]+/, "~");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <DialogTitle>Remove Project</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-[13px] text-foreground/80">
            Are you sure you want to remove{" "}
            <span className="font-semibold">{project?.project.name}</span>?
          </p>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <Folder className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-red-600 dark:text-red-400">
                The folder will be permanently deleted
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 break-all">
                {displayPath}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              "px-4 py-2 rounded-md text-[13px] font-medium",
              "bg-black/5 dark:bg-white/10",
              "hover:bg-black/10 dark:hover:bg-white/15",
              "transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className={cn(
              "px-4 py-2 rounded-md text-[13px] font-medium",
              "bg-red-500 text-white",
              "hover:bg-red-600 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? "Removing..." : "Remove"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
