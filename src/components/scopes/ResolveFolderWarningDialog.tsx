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
import { SelectableOptionCard } from "../ui/SelectableOptionCard";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useProjectsStore } from "../../stores/projects";
import type { ProjectFolderWarning, ScopeWithLinks } from "../../types";
import {
  FolderInput,
  Trash2,
  EyeOff,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

type ResolveOption = "move_to_folder" | "move_to_scope" | "remove" | "ignore";

interface ResolveFolderWarningDialogProps {
  warning: ProjectFolderWarning | null;
  scope: ScopeWithLinks;
  otherScopes: ScopeWithLinks[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveToScope?: (projectId: string, targetScopeId: string) => void;
}

export function ResolveFolderWarningDialog({
  warning,
  scope,
  otherScopes,
  open,
  onOpenChange,
  onMoveToScope,
}: ResolveFolderWarningDialogProps) {
  const [selectedOption, setSelectedOption] = useState<ResolveOption>("move_to_folder");
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { moveProjectToScopeFolder, ignoreFolderWarning } = useScopesStore();
  const { deleteProject } = useProjectsStore();

  const handleConfirm = async () => {
    if (!warning) return;

    setLoading(true);
    try {
      switch (selectedOption) {
        case "move_to_folder":
          await moveProjectToScopeFolder(warning.projectId);
          break;
        case "move_to_scope":
          if (selectedScopeId && onMoveToScope) {
            onMoveToScope(warning.projectId, selectedScopeId);
            // Close this dialog, the move dialog will handle the rest
            onOpenChange(false);
            return;
          }
          break;
        case "remove":
          await deleteProject(warning.projectId);
          break;
        case "ignore":
          await ignoreFolderWarning(scope.scope.id, warning.projectPath);
          break;
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to resolve warning:", error);
    } finally {
      setLoading(false);
    }
  };

  const folderDisplay = scope.scope.defaultFolder?.replace(/^\/Users\/[^/]+/, "~");
  const pathDisplay = warning?.projectPath.replace(/^\/Users\/[^/]+/, "~");

  const scopesWithFolders = otherScopes.filter((s) => s.scope.defaultFolder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>Resolve Location Issue</DialogTitle>
              <DialogDescription>
                <span className="font-medium">{warning?.projectName}</span> is outside
                the scope folder
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 mb-4">
            <p className="text-[11px] text-muted-foreground">Current location:</p>
            <p className="text-[12px] text-foreground/80 font-mono mt-0.5 break-all">
              {pathDisplay}
            </p>
          </div>

          <div className="space-y-2">
            <SelectableOptionCard
              selected={selectedOption === "move_to_folder"}
              onClick={() => setSelectedOption("move_to_folder")}
              icon={<FolderInput className="h-4 w-4" />}
              title="Move to scope folder"
              description={`Physically move to ${folderDisplay}`}
            />

            {scopesWithFolders.length > 0 && (
              <SelectableOptionCard
                selected={selectedOption === "move_to_scope"}
                onClick={() => setSelectedOption("move_to_scope")}
                icon={<ArrowRightLeft className="h-4 w-4" />}
                title="Move to another scope"
                description="Transfer this project to a different scope"
              >
                {selectedOption === "move_to_scope" && (
                  <div className="space-y-1.5">
                    {scopesWithFolders.map((s) => (
                      <button
                        key={s.scope.id}
                        type="button"
                        onClick={() => setSelectedScopeId(s.scope.id)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-md text-left",
                          "transition-colors",
                          selectedScopeId === s.scope.id
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-black/[0.03] dark:bg-white/[0.05] border border-transparent hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                        )}
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.scope.color || "#6b7280" }}
                        />
                        <span className="text-[12px] font-medium flex-1">
                          {s.scope.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {s.scope.defaultFolder?.replace(/^\/Users\/[^/]+/, "~")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </SelectableOptionCard>
            )}

            <SelectableOptionCard
              selected={selectedOption === "remove"}
              onClick={() => setSelectedOption("remove")}
              icon={<Trash2 className="h-4 w-4" />}
              title="Remove from scope"
              description="Remove project reference (files remain on disk)"
            />

            <SelectableOptionCard
              selected={selectedOption === "ignore"}
              onClick={() => setSelectedOption("ignore")}
              icon={<EyeOff className="h-4 w-4" />}
              title="Ignore this warning"
              description="Keep the project as-is, don't show this warning again"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={selectedOption === "move_to_scope" && !selectedScopeId}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
