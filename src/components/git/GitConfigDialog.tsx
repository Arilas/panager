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
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import type { ScopeWithLinks, ScopeGitConfig, GpgSigningMethod } from "../../types";
import * as api from "../../lib/tauri";
import { GitBranch, User, Mail, Key, Shield, Info, FileKey } from "lucide-react";

interface GitConfigDialogProps {
  scope: ScopeWithLinks;
  existingConfig?: ScopeGitConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitConfigDialog({
  scope,
  existingConfig,
  open,
  onOpenChange,
}: GitConfigDialogProps) {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [signingMethod, setSigningMethod] = useState<GpgSigningMethod>("none");
  const [signingKey, setSigningKey] = useState("");
  const [rawGpgConfig, setRawGpgConfig] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshGitConfig } = useScopesStore();

  useEffect(() => {
    if (open && existingConfig) {
      setUserName(existingConfig.userName || "");
      setUserEmail(existingConfig.userEmail || "");
      setSigningMethod((existingConfig.gpgSigningMethod as GpgSigningMethod) || (existingConfig.gpgSign ? "manual" : "none"));
      setSigningKey(existingConfig.signingKey || "");
      setRawGpgConfig(existingConfig.rawGpgConfig || "");
    }
  }, [open, existingConfig]);

  const resetForm = () => {
    setUserName("");
    setUserEmail("");
    setSigningMethod("none");
    setSigningKey("");
    setRawGpgConfig("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Create the config file
      await api.createScopeGitConfigFile(
        scope.scope.id,
        userName.trim(),
        userEmail.trim(),
        signingMethod,
        signingMethod === "manual" ? signingKey.trim() || null : null,
        signingMethod === "password_manager" ? rawGpgConfig.trim() || null : null
      );

      // If scope has a default folder, also create the includeIf entry
      if (scope.scope.defaultFolder) {
        const configPath = `${scope.scope.defaultFolder}/.gitconfig`;
        await api.createGitIncludeIf(scope.scope.defaultFolder, configPath);
      }

      // Refresh the git config in the store
      await refreshGitConfig(scope.scope.id);

      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const isEditing = !!existingConfig?.userName || !!existingConfig?.userEmail;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {isEditing ? "Edit Git Identity" : "Setup Git Identity"}
          </DialogTitle>
          <DialogDescription>
            Configure the git identity for projects in this scope.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-[12px] text-red-500">{error}</p>
            </div>
          )}

          <div className="p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-blue-600 dark:text-blue-400">
                <p className="font-medium mb-1">How this works:</p>
                <p>
                  This creates a .gitconfig file in your scope folder and adds an
                  includeIf rule to your global ~/.gitconfig. All repos inside
                  the scope folder will automatically use this identity.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your Name"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="pl-9"
                type="email"
              />
            </div>
          </div>

          {/* GPG Signing Method Toggle */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Commit Signing
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSigningMethod("none")}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all",
                  signingMethod === "none"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                )}
              >
                <Shield className={cn(
                  "h-4 w-4",
                  signingMethod === "none" ? "text-primary" : "text-muted-foreground"
                )} />
                <p className={cn(
                  "text-[11px] font-medium",
                  signingMethod === "none" ? "text-foreground" : "text-foreground/70"
                )}>
                  None
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSigningMethod("manual")}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all",
                  signingMethod === "manual"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                )}
              >
                <Key className={cn(
                  "h-4 w-4",
                  signingMethod === "manual" ? "text-primary" : "text-muted-foreground"
                )} />
                <p className={cn(
                  "text-[11px] font-medium",
                  signingMethod === "manual" ? "text-foreground" : "text-foreground/70"
                )}>
                  GPG Key
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSigningMethod("password_manager")}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all",
                  signingMethod === "password_manager"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                )}
              >
                <FileKey className={cn(
                  "h-4 w-4",
                  signingMethod === "password_manager" ? "text-primary" : "text-muted-foreground"
                )} />
                <p className={cn(
                  "text-[11px] font-medium",
                  signingMethod === "password_manager" ? "text-foreground" : "text-foreground/70"
                )}>
                  1Password
                </p>
              </button>
            </div>
          </div>

          {/* Manual GPG Key Input */}
          {signingMethod === "manual" && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground/70">
                Signing Key ID
                <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={signingKey}
                  onChange={(e) => setSigningKey(e.target.value)}
                  placeholder="e.g., 3AA5C34371567BD2"
                  className="pl-9 font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your GPG key ID. If empty, git will use the default signing key.
              </p>
            </div>
          )}

          {/* Password Manager / Raw Config */}
          {signingMethod === "password_manager" && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">
                    <p className="font-medium mb-1">Password Manager Mode</p>
                    <p>
                      Paste the gitconfig snippet from your password manager (1Password, Bitwarden, etc.).
                      This will be appended to the scope's .gitconfig file.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-medium text-foreground/70">
                  Git Config Snippet *
                </label>
                <textarea
                  value={rawGpgConfig}
                  onChange={(e) => setRawGpgConfig(e.target.value)}
                  placeholder={`[gpg]
    format = ssh

[gpg "ssh"]
    program = "/Applications/1Password.app/Contents/MacOS/op-ssh-sign"

[commit]
    gpgsign = true

[user]
    signingkey = ssh-ed25519 AAAA...`}
                  rows={8}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-[12px] font-mono",
                    "bg-white dark:bg-white/5",
                    "border border-black/10 dark:border-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "resize-none"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  The complete gitconfig snippet for commit signing from your password manager.
                </p>
              </div>
            </div>
          )}

          {scope.scope.defaultFolder && (
            <div className="p-3 rounded-md bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium">Config location: </span>
                {scope.scope.defaultFolder}/.gitconfig
              </p>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!userName.trim() || !userEmail.trim()}
              loading={loading}
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Config"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
