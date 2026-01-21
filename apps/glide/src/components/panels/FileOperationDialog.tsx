/**
 * File Operation Confirmation Dialogs
 *
 * Reusable confirmation dialogs for file tree operations like delete and move.
 */

import { File, Folder, ArrowRight } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";

/** Props for delete confirmation dialog */
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  isDirectory: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/** Delete confirmation dialog */
export function DeleteFileDialog({
  open,
  onOpenChange,
  path,
  isDirectory,
  loading = false,
  onConfirm,
}: DeleteDialogProps) {
  const name = path.substring(path.lastIndexOf("/") + 1);
  const displayPath = path.replace(/^\/Users\/[^/]+/, "~");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${isDirectory ? "Folder" : "File"}`}
      description="This action cannot be undone."
      variant="danger"
      confirmLabel={loading ? "Deleting..." : "Delete"}
      loading={loading}
      onConfirm={onConfirm}
      maxWidth="sm:max-w-[450px]"
    >
      <div className="space-y-3">
        <p className="text-[13px] text-foreground/80">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{name}</span>?
        </p>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
          {isDirectory ? (
            <Folder className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          ) : (
            <File className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400">
              {isDirectory
                ? "The folder and all its contents will be permanently deleted"
                : "The file will be permanently deleted"}
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

/** Props for move confirmation dialog */
interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: string[];
  targetDir: string;
  loading?: boolean;
  onConfirm: () => void;
}

/** Move (cut + paste) confirmation dialog */
export function MoveFileDialog({
  open,
  onOpenChange,
  items,
  targetDir,
  loading = false,
  onConfirm,
}: MoveDialogProps) {
  const itemNames = items.map((p) => p.substring(p.lastIndexOf("/") + 1));
  const targetName = targetDir.substring(targetDir.lastIndexOf("/") + 1);
  const displayTarget = targetDir.replace(/^\/Users\/[^/]+/, "~");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move Items"
      description="Items will be moved to the new location."
      variant="warning"
      confirmLabel={loading ? "Moving..." : "Move"}
      loading={loading}
      onConfirm={onConfirm}
      maxWidth="sm:max-w-[450px]"
    >
      <div className="space-y-3">
        <p className="text-[13px] text-foreground/80">
          Move{" "}
          <span className="font-semibold">
            {items.length === 1
              ? itemNames[0]
              : `${items.length} items`}
          </span>{" "}
          to{" "}
          <span className="font-semibold">{targetName}</span>?
        </p>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <ArrowRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
              Items will be moved from their current location
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 break-all">
              Destination: {displayTarget}
            </p>
            {items.length > 1 && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                <p className="font-medium mb-1">Items to move:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {itemNames.slice(0, 5).map((name, i) => (
                    <li key={i} className="truncate">{name}</li>
                  ))}
                  {items.length > 5 && (
                    <li>...and {items.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}
