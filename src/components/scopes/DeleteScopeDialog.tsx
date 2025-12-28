import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useState } from "react";
import type { ScopeWithLinks } from "../../types";
import { AlertTriangle } from "lucide-react";

interface DeleteScopeDialogProps {
  scope: ScopeWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteScopeDialog({
  scope,
  open,
  onOpenChange,
}: DeleteScopeDialogProps) {
  const [loading, setLoading] = useState(false);
  const { deleteScope } = useScopesStore();

  const handleDelete = async () => {
    if (!scope) return;

    setLoading(true);
    try {
      await deleteScope(scope.scope.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete scope:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <DialogTitle>Delete Scope</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-[13px] text-foreground/80">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{scope?.scope.name}</span>?
          </p>
          <p className="text-[12px] text-muted-foreground mt-2">
            All projects in this scope will also be removed from Panager.
            The actual project files on disk will not be deleted.
          </p>
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
            {loading ? "Deleting..." : "Delete Scope"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
