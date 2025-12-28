import { useState } from "react";
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
import { SCOPE_COLORS } from "../../types";

interface NewScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewScopeDialog({ open, onOpenChange }: NewScopeDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SCOPE_COLORS[0].value);
  const [loading, setLoading] = useState(false);

  const { createScope } = useScopesStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createScope({ name: name.trim(), color });
      setName("");
      setColor(SCOPE_COLORS[0].value);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create scope:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Scope</DialogTitle>
          <DialogDescription>
            Create a new scope to organize your projects.
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
              {loading ? "Creating..." : "Create Scope"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
