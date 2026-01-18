import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useScopesStore } from "../../stores/scopes";
import { useState } from "react";
import type { ScopeWithLinks } from "../../types";

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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Scope"
      description="This action cannot be undone."
      variant="danger"
      confirmLabel={loading ? "Deleting..." : "Delete Scope"}
      loading={loading}
      onConfirm={handleDelete}
    >
      <p className="text-[13px] text-foreground/80">
        Are you sure you want to delete{" "}
        <span className="font-semibold">{scope?.scope.name}</span>?
      </p>
      <p className="text-[12px] text-muted-foreground mt-2">
        All projects in this scope will also be removed from Panager. The
        actual project files on disk will not be deleted.
      </p>
    </ConfirmDialog>
  );
}
