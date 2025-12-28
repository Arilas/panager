import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/Dialog";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { LINK_TYPES } from "../../types";
import type { ScopeWithLinks, ScopeLink } from "../../types";
import {
  Plus,
  Trash2,
  ExternalLink,
  Github,
  Link as LinkIcon,
} from "lucide-react";

interface ScopeLinksDialogProps {
  scope: ScopeWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScopeLinksDialog({
  scope,
  open,
  onOpenChange,
}: ScopeLinksDialogProps) {
  const [newLink, setNewLink] = useState({
    type: "github",
    label: "",
    url: "",
  });
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const { createScopeLink, deleteScopeLink } = useScopesStore();

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scope || !newLink.label.trim() || !newLink.url.trim()) return;

    setLoading(true);
    try {
      await createScopeLink({
        scopeId: scope.scope.id,
        linkType: newLink.type,
        label: newLink.label.trim(),
        url: newLink.url.trim(),
      });
      setNewLink({ type: "github", label: "", url: "" });
      setAdding(false);
    } catch (error) {
      console.error("Failed to add link:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteScopeLink(linkId);
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Manage Links
          </DialogTitle>
          <DialogDescription>
            Add quick access links for{" "}
            <span className="font-medium">{scope?.scope.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Links */}
          <div className="space-y-2">
            {scope?.links.length === 0 && !adding ? (
              <div className="text-center py-8 text-[13px] text-muted-foreground">
                No links added yet
              </div>
            ) : (
              scope?.links.map((link) => (
                <LinkItem
                  key={link.id}
                  link={link}
                  onDelete={() => handleDeleteLink(link.id)}
                />
              ))
            )}
          </div>

          {/* Add New Link Form */}
          {adding ? (
            <form onSubmit={handleAddLink} className="space-y-3 p-3 rounded-lg border border-black/10 dark:border-white/10">
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-foreground/70">
                  Link Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {LINK_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewLink({ ...newLink, type: type.id })}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[12px] transition-colors",
                        newLink.type === type.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground/70">
                    Label
                  </label>
                  <Input
                    value={newLink.label}
                    onChange={(e) =>
                      setNewLink({ ...newLink, label: e.target.value })
                    }
                    placeholder="e.g., Main Repo"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground/70">
                    URL
                  </label>
                  <Input
                    value={newLink.url}
                    onChange={(e) =>
                      setNewLink({ ...newLink, url: e.target.value })
                    }
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewLink({ type: "github", label: "", url: "" });
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium",
                    "bg-black/5 dark:bg-white/10",
                    "hover:bg-black/10 dark:hover:bg-white/15",
                    "transition-colors"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newLink.label.trim() || !newLink.url.trim() || loading}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {loading ? "Adding..." : "Add Link"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg",
                "border border-dashed border-black/10 dark:border-white/10",
                "text-[13px] text-muted-foreground",
                "hover:border-primary/50 hover:text-primary transition-colors"
              )}
            >
              <Plus className="h-4 w-4" />
              Add Link
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkItem({
  link,
  onDelete,
}: {
  link: ScopeLink;
  onDelete: () => void;
}) {
  const typeInfo = LINK_TYPES.find((t) => t.id === link.linkType);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "bg-black/[0.02] dark:bg-white/[0.02]",
        "border border-black/5 dark:border-white/5",
        "group"
      )}
    >
      <div className="h-8 w-8 rounded-md bg-black/5 dark:bg-white/10 flex items-center justify-center">
        {link.linkType === "github" ? (
          <Github className="h-4 w-4 text-foreground/60" />
        ) : (
          <LinkIcon className="h-4 w-4 text-foreground/60" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{link.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground/70">
            {typeInfo?.label || "Custom"}
          </span>
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-muted-foreground hover:text-primary truncate block"
          onClick={(e) => e.stopPropagation()}
        >
          {link.url}
        </a>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "p-1.5 rounded-md",
            "hover:bg-black/5 dark:hover:bg-white/10",
            "transition-colors"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <button
          onClick={onDelete}
          className={cn(
            "p-1.5 rounded-md",
            "hover:bg-red-500/10 text-red-500",
            "transition-colors"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
