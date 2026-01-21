import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useProjectsStore } from "../../stores/projects";
import { useState } from "react";
import type { ProjectWithStatus } from "../../types";
import { Folder } from "lucide-react";

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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove Project"
      description="This action cannot be undone."
      variant="danger"
      confirmLabel={loading ? "Removing..." : "Remove"}
      loading={loading}
      onConfirm={handleDelete}
      maxWidth="sm:max-w-[450px]"
    >
      <div className="space-y-3">
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
    </ConfirmDialog>
  );
}
