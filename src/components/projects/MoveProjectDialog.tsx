import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SelectableOptionCard } from "../ui/SelectableOptionCard";
import { useProjectsStore } from "../../stores/projects";
import { useScopesStore } from "../../stores/scopes";
import { checkFolderExists } from "../../lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectWithStatus, ScopeWithLinks } from "../../types";
import {
  ArrowRightLeft,
  FolderInput,
  FolderOpen,
  MapPin,
  Loader2,
  AlertTriangle,
  FolderPlus,
} from "lucide-react";

type MoveOption =
  | "move_to_target"
  | "keep_location"
  | "move_to_custom"
  | "set_target_folder";

interface MoveProjectDialogProps {
  project: ProjectWithStatus | null;
  sourceScope: ScopeWithLinks | null;
  targetScope: ScopeWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MoveProjectDialog({
  project,
  sourceScope,
  targetScope,
  open: isOpen,
  onOpenChange,
  onSuccess,
}: MoveProjectDialogProps) {
  const [selectedOption, setSelectedOption] = useState<MoveOption>("keep_location");
  const [customFolderPath, setCustomFolderPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderConflict, setFolderConflict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const { moveProjectToScopeWithFolder } = useProjectsStore();
  const { updateScope } = useScopesStore();

  // Determine scenario based on defaultFolder settings
  const scenario = useMemo(() => {
    const sourceHasFolder = !!sourceScope?.scope.defaultFolder;
    const targetHasFolder = !!targetScope?.scope.defaultFolder;

    if (!sourceHasFolder && targetHasFolder) return 1;
    if (sourceHasFolder && !targetHasFolder) return 2;
    if (sourceHasFolder && targetHasFolder) return 3;
    return 4; // Neither have folder
  }, [sourceScope, targetScope]);

  // Get project folder name
  const projectFolderName = useMemo(() => {
    if (!project) return "";
    const parts = project.project.path.split("/");
    return parts[parts.length - 1] || "";
  }, [project]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Default selection based on scenario
      if (scenario === 4) {
        setSelectedOption("keep_location");
      } else if (scenario === 1 || scenario === 3) {
        setSelectedOption("move_to_target");
      } else {
        setSelectedOption("keep_location");
      }
      setCustomFolderPath("");
      setNewFolderName(projectFolderName);
      setFolderConflict(false);
      setLoading(false);
    }
  }, [isOpen, scenario, projectFolderName]);

  // Check for folder conflict when target folder or name changes
  useEffect(() => {
    if (!isOpen || !targetScope?.scope.defaultFolder || selectedOption !== "move_to_target") {
      setFolderConflict(false);
      return;
    }

    const checkConflict = async () => {
      setCheckingConflict(true);
      try {
        const folderName = newFolderName || projectFolderName;
        const exists = await checkFolderExists(targetScope.scope.id, folderName);
        setFolderConflict(exists);
      } catch {
        setFolderConflict(false);
      } finally {
        setCheckingConflict(false);
      }
    };

    const debounce = setTimeout(checkConflict, 300);
    return () => clearTimeout(debounce);
  }, [isOpen, targetScope, newFolderName, projectFolderName, selectedOption]);

  const handleBrowseFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Destination Folder",
    });

    if (selected && typeof selected === "string") {
      setCustomFolderPath(selected);
    }
  };

  const handleConfirm = async () => {
    if (!project || !targetScope) return;

    setLoading(true);
    try {
      let targetFolderPath: string | undefined;
      let folderName: string | undefined;

      if (selectedOption === "move_to_target" && targetScope.scope.defaultFolder) {
        targetFolderPath = targetScope.scope.defaultFolder;
        folderName = newFolderName || projectFolderName;
      } else if (selectedOption === "move_to_custom" && customFolderPath) {
        targetFolderPath = customFolderPath;
        folderName = projectFolderName;
      } else if (selectedOption === "set_target_folder" && customFolderPath) {
        // First set the target scope's default folder
        await updateScope(
          targetScope.scope.id,
          undefined,
          undefined,
          undefined,
          undefined,
          customFolderPath
        );
        targetFolderPath = customFolderPath;
        folderName = projectFolderName;
      }

      await moveProjectToScopeWithFolder(
        project.project.id,
        targetScope.scope.id,
        targetFolderPath,
        folderName
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to move project:", error);
    } finally {
      setLoading(false);
    }
  };

  const targetFolderDisplay = targetScope?.scope.defaultFolder?.replace(/^\/Users\/[^/]+/, "~");
  const sourceFolderDisplay = sourceScope?.scope.defaultFolder?.replace(/^\/Users\/[^/]+/, "~");

  // Scenario 4: Simple confirmation
  if (scenario === 4) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Move Project</DialogTitle>
                <DialogDescription>
                  Confirm moving this project to another scope
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-[13px] text-foreground/80">
              Do you want to move{" "}
              <span className="font-semibold">{project?.project.name}</span> to{" "}
              <span className="font-semibold">{targetScope?.scope.name}</span>?
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              The project files will remain in their current location.
            </p>
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
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Move Project</DialogTitle>
              <DialogDescription>
                Move <span className="font-medium">{project?.project.name}</span> to{" "}
                <span className="font-medium">{targetScope?.scope.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Scenario 1: Source has no folder, Target has folder */}
          {scenario === 1 && (
            <>
              <SelectableOptionCard
                selected={selectedOption === "move_to_target"}
                onClick={() => setSelectedOption("move_to_target")}
                icon={<FolderInput className="h-4 w-4" />}
                title="Move to scope folder"
                description={`Physically move the project to ${targetFolderDisplay}`}
              >
                {selectedOption === "move_to_target" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="flex-1"
                      />
                      {checkingConflict && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {folderConflict && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        A folder with this name already exists. Please choose a different name.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Will be moved to: {targetFolderDisplay}/{newFolderName || projectFolderName}
                    </p>
                  </div>
                )}
              </SelectableOptionCard>

              <SelectableOptionCard
                selected={selectedOption === "keep_location"}
                onClick={() => setSelectedOption("keep_location")}
                icon={<MapPin className="h-4 w-4" />}
                title="Keep current location"
                description="Only change the scope reference, files stay where they are"
              />
            </>
          )}

          {/* Scenario 2: Source has folder, Target has no folder */}
          {scenario === 2 && (
            <>
              <SelectableOptionCard
                selected={selectedOption === "move_to_custom"}
                onClick={() => setSelectedOption("move_to_custom")}
                icon={<FolderOpen className="h-4 w-4" />}
                title="Move to custom folder"
                description="Choose where to move the project files"
              >
                {selectedOption === "move_to_custom" && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={customFolderPath}
                      onChange={(e) => setCustomFolderPath(e.target.value)}
                      placeholder="Select destination folder..."
                      className="flex-1"
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleBrowseFolder}
                    >
                      Browse
                    </Button>
                  </div>
                )}
              </SelectableOptionCard>

              <SelectableOptionCard
                selected={selectedOption === "set_target_folder"}
                onClick={() => setSelectedOption("set_target_folder")}
                icon={<FolderPlus className="h-4 w-4" />}
                title={`Set ${targetScope?.scope.name}'s folder & move`}
                description="Configure a default folder for this scope and move the project there"
              >
                {selectedOption === "set_target_folder" && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={customFolderPath}
                      onChange={(e) => setCustomFolderPath(e.target.value)}
                      placeholder="Select folder for scope..."
                      className="flex-1"
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleBrowseFolder}
                    >
                      Browse
                    </Button>
                  </div>
                )}
              </SelectableOptionCard>

              <SelectableOptionCard
                selected={selectedOption === "keep_location"}
                onClick={() => setSelectedOption("keep_location")}
                icon={<MapPin className="h-4 w-4" />}
                title="Keep current location"
                description={`Files remain in ${sourceFolderDisplay}, only scope reference changes`}
              />
            </>
          )}

          {/* Scenario 3: Both have folders */}
          {scenario === 3 && (
            <>
              <SelectableOptionCard
                selected={selectedOption === "move_to_target"}
                onClick={() => setSelectedOption("move_to_target")}
                icon={<FolderInput className="h-4 w-4" />}
                title="Move to scope folder"
                description={`Move from ${sourceFolderDisplay} to ${targetFolderDisplay}`}
              >
                {selectedOption === "move_to_target" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="flex-1"
                      />
                      {checkingConflict && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {folderConflict && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        A folder with this name already exists. Please choose a different name.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Will be moved to: {targetFolderDisplay}/{newFolderName || projectFolderName}
                    </p>
                  </div>
                )}
              </SelectableOptionCard>

              <SelectableOptionCard
                selected={selectedOption === "keep_location"}
                onClick={() => setSelectedOption("keep_location")}
                icon={<MapPin className="h-4 w-4" />}
                title="Keep current location"
                description={`Files remain in ${sourceFolderDisplay}, only scope reference changes`}
              />
            </>
          )}
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
            disabled={
              (selectedOption === "move_to_target" && folderConflict) ||
              ((selectedOption === "move_to_custom" || selectedOption === "set_target_folder") && !customFolderPath)
            }
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
