import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useEditorsStore } from "../../stores/editors";
import { SCOPE_COLORS } from "../../types";
import type { ScopeWithLinks } from "../../types";
import { Code } from "lucide-react";

interface EditScopeDialogProps {
  scope: ScopeWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditScopeDialog({
  scope,
  open,
  onOpenChange,
}: EditScopeDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SCOPE_COLORS[0].value);
  const [defaultEditorId, setDefaultEditorId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { updateScope } = useScopesStore();
  const { editors } = useEditorsStore();

  useEffect(() => {
    if (scope) {
      setName(scope.scope.name);
      setColor(scope.scope.color || SCOPE_COLORS[0].value);
      setDefaultEditorId(scope.scope.defaultEditorId || "");
    }
  }, [scope]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !scope) return;

    setLoading(true);
    try {
      await updateScope(
        scope.scope.id,
        name.trim(),
        color,
        undefined,
        defaultEditorId || undefined
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update scope:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Scope</DialogTitle>
          <DialogDescription>
            Update scope name and color.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Personal, Work, Side Projects"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    "ring-offset-2 ring-offset-background",
                    color === c.value
                      ? "ring-2 ring-primary scale-110"
                      : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Default Editor */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Default Editor
            </label>
            <div className="relative">
              <Code className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={defaultEditorId}
                onChange={(e) => setDefaultEditorId(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-md text-[13px]",
                  "bg-white dark:bg-white/5",
                  "border border-black/10 dark:border-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "appearance-none cursor-pointer"
                )}
              >
                <option value="">Use global default</option>
                {editors
                  .filter((e) => e.isAvailable)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Projects in this scope will open with this editor by default
            </p>
          </div>

          <DialogFooter className="pt-4">
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
              type="submit"
              disabled={!name.trim() || loading}
              className={cn(
                "px-4 py-2 rounded-md text-[13px] font-medium",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
