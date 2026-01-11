import { useState, useEffect } from "react";
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
import { useSshStore } from "../../stores/ssh";
import { useSettingsStore } from "../../stores/settings";
import { SCOPE_COLORS } from "../../types";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { SshAliasDialog } from "../ssh/SshAliasDialog";
import {
  NameField,
  ColorField,
  FolderField,
  SshAliasField,
} from "./ScopeFormFields";

interface NewScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewScopeDialog({ open, onOpenChange }: NewScopeDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SCOPE_COLORS[0].value);
  const [defaultFolder, setDefaultFolder] = useState<string>("");
  const [sshAlias, setSshAlias] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showSshAliasDialog, setShowSshAliasDialog] = useState(false);

  const { createScope } = useScopesStore();
  const { settings } = useSettingsStore();
  const { aliases, fetchAliases } = useSshStore();

  // Fetch SSH aliases when dialog opens and SSH integration is enabled
  useEffect(() => {
    if (open && settings.max_ssh_integration) {
      fetchAliases();
    }
  }, [open, settings.max_ssh_integration, fetchAliases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createScope({
        name: name.trim(),
        color,
        defaultFolder: defaultFolder || undefined,
        sshAlias: sshAlias || undefined,
      });
      setName("");
      setColor(SCOPE_COLORS[0].value);
      setDefaultFolder("");
      setSshAlias("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create scope:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Default Folder for Scope",
      });
      if (selected && typeof selected === "string") {
        setDefaultFolder(selected);
      }
    } catch (error) {
      console.error("Failed to open folder dialog:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Scope</DialogTitle>
          <DialogDescription>
            Create a new scope to organize your projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <NameField value={name} onChange={setName} autoFocus />

          <ColorField value={color} onChange={setColor} />

          <FolderField
            value={defaultFolder}
            onChange={setDefaultFolder}
            onBrowse={handleBrowseFolder}
            optional
          />

          {settings.max_ssh_integration && (
            <SshAliasField
              value={sshAlias}
              onChange={setSshAlias}
              aliases={aliases}
              onNewAlias={() => setShowSshAliasDialog(true)}
              optional
            />
          )}

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

      {/* SSH Alias Creation Dialog */}
      <SshAliasDialog
        open={showSshAliasDialog}
        onOpenChange={setShowSshAliasDialog}
        onCreated={(host) => {
          setSshAlias(host);
          fetchAliases();
        }}
      />
    </Dialog>
  );
}
