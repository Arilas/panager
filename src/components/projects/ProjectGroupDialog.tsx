import { useState, useEffect } from "react";
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
import { useProjectsStore } from "../../stores/projects";
import { SCOPE_COLORS } from "../../types";
import type { ProjectGroup } from "../../types";
import { cn } from "../../lib/utils";
import { Pencil, Trash2 } from "lucide-react";

function getSubmitButtonText(loading: boolean, isEditing: boolean): string {
  if (loading) {
    return isEditing ? "Updating..." : "Creating...";
  }
  return isEditing ? "Update Group" : "Create Group";
}

interface ProjectGroupDialogProps {
  scopeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupsChanged?: () => void;
}

export function ProjectGroupDialog({
  scopeId,
  open,
  onOpenChange,
  onGroupsChanged,
}: ProjectGroupDialogProps) {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SCOPE_COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const {
    getProjectGroups,
    createProjectGroup,
    updateProjectGroup,
    deleteProjectGroup,
  } = useProjectsStore();

  useEffect(() => {
    if (open && scopeId) {
      loadGroups();
    }
  }, [open, scopeId]);

  const loadGroups = async () => {
    try {
      const loadedGroups = await getProjectGroups(scopeId);
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Failed to load project groups:", error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createProjectGroup({
        scopeId,
        name: name.trim(),
        color: color || null,
      });
      setName("");
      setColor(SCOPE_COLORS[0].value);
      await loadGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to create project group:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !name.trim()) return;

    setLoading(true);
    try {
      await updateProjectGroup(editingGroup.id, name.trim(), color);
      setEditingGroup(null);
      setName("");
      setColor(SCOPE_COLORS[0].value);
      await loadGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to update project group:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this group? Projects in this group will become ungrouped."
      )
    ) {
      return;
    }

    setDeletingGroupId(groupId);
    try {
      await deleteProjectGroup(groupId);
      await loadGroups();
      onGroupsChanged?.();
    } catch (error) {
      console.error("Failed to delete project group:", error);
    } finally {
      setDeletingGroupId(null);
    }
  };

  const handleEdit = (group: ProjectGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setColor(group.color || SCOPE_COLORS[0].value);
  };

  const handleCancel = () => {
    setEditingGroup(null);
    setName("");
    setColor(SCOPE_COLORS[0].value);
  };

  const isEditing = editingGroup !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Project Groups</DialogTitle>
          <DialogDescription>
            Organize your projects into groups for better organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Groups */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[13px] font-medium text-foreground/80">
                Existing Groups
              </h3>
              <div className="space-y-1.5">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md",
                      "bg-black/5 dark:bg-white/10",
                      "border border-black/5 dark:border-white/5"
                    )}
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: group.color || "#6b7280",
                      }}
                    />
                    <span className="flex-1 text-[13px] text-foreground/80">
                      {group.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(group)}
                        className={cn(
                          "p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10",
                          "transition-colors"
                        )}
                        title="Edit group"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(group.id)}
                        disabled={deletingGroupId === group.id}
                        className={cn(
                          "p-1.5 rounded hover:bg-red-500/10",
                          "transition-colors",
                          deletingGroupId === group.id && "opacity-50"
                        )}
                        title="Delete group"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create/Edit Form */}
          <form
            onSubmit={isEditing ? handleUpdate : handleCreate}
            className="space-y-4 pt-2 border-t border-black/5 dark:border-white/5"
          >
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {isEditing ? "Edit Group" : "New Group"}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                autoFocus
                className="text-[13px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-8 h-8 rounded-md transition-all",
                      "border-2",
                      color === c.value
                        ? "border-foreground/30 scale-110"
                        : "border-transparent hover:border-foreground/10"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.id}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="glass"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={!name.trim() || loading}
                loading={loading}
                variant="glass-scope"
              >
                {getSubmitButtonText(loading, isEditing)}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
