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
import type { ScopeWithLinks } from "../../types";
import {
  GitBranch,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Terminal,
  Check,
  X,
  Key,
  Globe,
  Loader2,
} from "lucide-react";
import { useCloneRepositoryForm } from "./hooks";

interface CloneRepositoryDialogProps {
  scope: ScopeWithLinks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned?: (projectId: string) => void;
}

export function CloneRepositoryDialog({
  scope,
  open,
  onOpenChange,
  onCloned,
}: CloneRepositoryDialogProps) {
  const {
    // Form state
    url,
    setUrl,
    parsedUrl,
    parseError,
    folderName,
    setFolderName,
    folderExists,

    // SSH options
    useSshAlias,
    setUseSshAlias,
    showSshOptions,

    // Advanced options
    showAdvanced,
    setShowAdvanced,
    branch,
    setBranch,
    shallow,
    setShallow,

    // Clone progress
    cloning,
    status,
    progress,
    showLog,
    setShowLog,
    error,
    success,
    logRef,

    // Actions
    handleClone,
    canClone,
  } = useCloneRepositoryForm({ scope, open, onCloned });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Clone Repository
          </DialogTitle>
          <DialogDescription>
            Clone a git repository into{" "}
            <span className="font-medium">{scope.scope.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL display during/after cloning */}
          {(cloning || progress.length > 0) && parsedUrl && (
            <div className="rounded-md bg-black/5 dark:bg-white/5 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                {success ? "Cloned:" : "Cloning:"}
              </p>
              <code className="text-[12px] font-mono text-foreground/80 break-all">
                {useSshAlias && scope.scope.sshAlias
                  ? `git@${scope.scope.sshAlias}:${parsedUrl.owner}/${parsedUrl.repo}.git`
                  : parsedUrl.originalUrl}
              </code>
              <p className="text-[11px] text-muted-foreground mt-2">
                To: {scope.scope.defaultFolder}/{folderName}
              </p>
            </div>
          )}

          {/* Form elements - hidden during and after cloning */}
          {!cloning && progress.length === 0 && (
            <>
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-foreground/70">
                  Repository URL
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                  autoFocus
                />
                {parseError && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {parseError}
                  </p>
                )}
              </div>

              {/* Parsed URL Info */}
              {parsedUrl && (
                <div className="rounded-md bg-black/5 dark:bg-white/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    {parsedUrl.protocol === "ssh" ? (
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {parsedUrl.protocol.toUpperCase()}
                    </span>
                    <span className="text-foreground font-medium">
                      {parsedUrl.host}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground">{parsedUrl.owner}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground font-medium">
                      {parsedUrl.repo}
                    </span>
                  </div>

                  {parsedUrl.usesAlias && (
                    <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Using SSH alias: {parsedUrl.usesAlias}
                    </p>
                  )}

                  {parsedUrl.hasHttpCredentials && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      URL contains credentials - cannot convert to SSH
                    </p>
                  )}
                </div>
              )}

              {/* Folder Name */}
              {parsedUrl && (
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-foreground/70">
                    Folder Name
                  </label>
                  <Input
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Repository folder name"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Will be cloned to: {scope.scope.defaultFolder}/{folderName}
                  </p>
                  {folderExists && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />A folder with this
                      name already exists
                    </p>
                  )}
                </div>
              )}

              {/* SSH Alias Options */}
              {showSshOptions && (
                <div className="rounded-md border border-black/10 dark:border-white/10 p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSshAlias}
                      onChange={(e) => setUseSshAlias(e.target.checked)}
                      className="h-4 w-4 rounded border-black/20 dark:border-white/20"
                    />
                    <span className="text-[13px]">
                      Use SSH alias:{" "}
                      <span className="font-medium">
                        {scope.scope.sshAlias}
                      </span>
                    </span>
                  </label>
                  <p className="text-[11px] text-muted-foreground ml-6">
                    {parsedUrl?.protocol === "ssh"
                      ? "Update remote URL to use your SSH alias"
                      : "Convert to SSH and use your alias"}
                  </p>
                  {useSshAlias && parsedUrl && (
                    <div className="ml-6 mt-2 p-2 rounded bg-black/5 dark:bg-white/5">
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Final remote URL:
                      </p>
                      <code className="text-[11px] font-mono text-foreground/80 break-all">
                        git@{scope.scope.sshAlias}:{parsedUrl.owner}/
                        {parsedUrl.repo}.git
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Options */}
              {parsedUrl && (
                <div className="border-t border-black/5 dark:border-white/5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdvanced ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Advanced options
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-3 pl-1">
                      {/* Branch */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          Branch (optional)
                        </label>
                        <Input
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          placeholder="default branch"
                          className="h-8 text-[12px]"
                        />
                      </div>

                      {/* Shallow clone */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shallow}
                          onChange={(e) => setShallow(e.target.checked)}
                          className="h-4 w-4 rounded border-black/20 dark:border-white/20"
                        />
                        <span className="text-[12px]">
                          Shallow clone (--depth 1)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          - faster for large repos
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Progress Section */}
          {(cloning || progress.length > 0) && (
            <div className="space-y-2">
              {/* Status */}
              <div className="flex items-center gap-2">
                {cloning && !success && !error && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {success && <Check className="h-4 w-4 text-green-500" />}
                {error && <X className="h-4 w-4 text-red-500" />}
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    success && "text-green-500",
                    error && "text-red-500"
                  )}
                >
                  {status}
                </span>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-[12px] text-red-500 bg-red-500/10 rounded-md p-2">
                  {error}
                </p>
              )}

              {/* Log toggle */}
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Terminal className="h-3 w-3" />
                {showLog ? "Hide" : "Show"} log ({progress.length} lines)
              </button>

              {/* Log output */}
              {showLog && (
                <div
                  ref={logRef}
                  className={cn(
                    "rounded-md bg-black/5 dark:bg-black/30 p-2",
                    "font-mono text-[10px] leading-relaxed",
                    "max-h-[250px] overflow-y-auto",
                    "text-muted-foreground"
                  )}
                >
                  {progress.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="glass" onClick={() => onOpenChange(false)}>
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button
              onClick={handleClone}
              disabled={!canClone}
              loading={cloning}
              variant="glass-scope"
            >
              {cloning ? (
                "Cloning..."
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Clone
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
