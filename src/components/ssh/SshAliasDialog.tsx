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
import { useSshStore } from "../../stores/ssh";
import { Key, Server, User, FileKey, Shield, Info } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

type KeyMode = "private" | "public";

interface SshAliasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (host: string) => void;
}

export function SshAliasDialog({
  open,
  onOpenChange,
  onCreated,
}: SshAliasDialogProps) {
  const [host, setHost] = useState("");
  const [hostName, setHostName] = useState("");
  const [user, setUser] = useState("git");
  const [keyMode, setKeyMode] = useState<KeyMode>("private");
  const [identityFile, setIdentityFile] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createAlias } = useSshStore();

  const resetForm = () => {
    setHost("");
    setHostName("");
    setUser("git");
    setKeyMode("private");
    setIdentityFile("");
    setPublicKey("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !hostName.trim()) return;

    // Validate based on mode
    if (keyMode === "private" && !identityFile.trim()) {
      setError("Private key path is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAlias({
        host: host.trim(),
        hostName: hostName.trim(),
        user: user.trim() || null,
        // Only send identityFile if in private key mode
        identityFile: keyMode === "private" ? identityFile.trim() : null,
        // Send publicKey in both modes if provided (for reference/copying)
        publicKey: publicKey.trim() || null,
      });
      onCreated?.(host.trim());
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        title: "Select SSH Private Key",
        defaultPath: "~/.ssh",
      });
      if (selected && typeof selected === "string") {
        setIdentityFile(selected);
      }
    } catch (error) {
      console.error("Failed to open file dialog:", error);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Create SSH Alias
          </DialogTitle>
          <DialogDescription>
            Add a new SSH host alias to your ~/.ssh/config file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-[12px] text-red-500">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Host Alias *
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g., github-work"
                className="pl-9"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              The alias you'll use in git URLs (e.g., git@github-work:org/repo.git)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Hostname *
            </label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g., github.com"
                className="pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              The actual hostname to connect to
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              User
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="git"
                className="pl-9"
              />
            </div>
          </div>

          {/* Key Mode Toggle */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Authentication Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKeyMode("private")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                  keyMode === "private"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                )}
              >
                <FileKey className={cn(
                  "h-4 w-4",
                  keyMode === "private" ? "text-primary" : "text-muted-foreground"
                )} />
                <div>
                  <p className={cn(
                    "text-[12px] font-medium",
                    keyMode === "private" ? "text-foreground" : "text-foreground/70"
                  )}>
                    Private Key
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Key stored on disk
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setKeyMode("public")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                  keyMode === "public"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                )}
              >
                <Shield className={cn(
                  "h-4 w-4",
                  keyMode === "public" ? "text-primary" : "text-muted-foreground"
                )} />
                <div>
                  <p className={cn(
                    "text-[12px] font-medium",
                    keyMode === "public" ? "text-foreground" : "text-foreground/70"
                  )}>
                    Password Manager
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    1Password, etc.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Private Key Mode */}
          {keyMode === "private" && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground/70">
                Private Key Path *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FileKey className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={identityFile}
                    onChange={(e) => setIdentityFile(e.target.value)}
                    placeholder="~/.ssh/id_work"
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBrowseKey}
                  className={cn(
                    "px-3 py-2 rounded-md text-[12px]",
                    "bg-black/5 dark:bg-white/10",
                    "hover:bg-black/10 dark:hover:bg-white/15",
                    "transition-colors shrink-0"
                  )}
                >
                  Browse
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Path to your SSH private key file
              </p>
            </div>
          )}

          {/* Public Key Only Mode */}
          {keyMode === "public" && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">
                    <p className="font-medium mb-1">Password Manager Mode</p>
                    <p>
                      Your password manager (1Password, Bitwarden, etc.) will automatically
                      provide the SSH key when connecting. No IdentityFile will be added
                      to the SSH config.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-medium text-foreground/70">
                  Public Key
                  <span className="text-muted-foreground/60 font-normal ml-1">(optional, for reference)</span>
                </label>
                <textarea
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA... comment"
                  rows={3}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-[12px] font-mono",
                    "bg-white dark:bg-white/5",
                    "border border-black/10 dark:border-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "resize-none"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Saved to ~/.ssh/{host || "alias"}.pub for easy copying to services
                </p>
              </div>
            </div>
          )}

          {/* Optional public key for private key mode */}
          {keyMode === "private" && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground/70">
                Public Key
                <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="ssh-ed25519 AAAA... comment"
                rows={2}
                className={cn(
                  "w-full px-3 py-2 rounded-md text-[12px] font-mono",
                  "bg-white dark:bg-white/5",
                  "border border-black/10 dark:border-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "resize-none"
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                Save the public key for easy copying to services
              </p>
            </div>
          )}

          <DialogFooter className="pt-4">
            <button
              type="button"
              onClick={() => handleClose(false)}
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
              disabled={!host.trim() || !hostName.trim() || loading}
              className={cn(
                "px-4 py-2 rounded-md text-[13px] font-medium",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? "Creating..." : "Create Alias"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
