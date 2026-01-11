import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import type { ScopeWithLinks, ScopeGitConfig } from "../../types";
import {
  User,
  Mail,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  Settings,
  AlertCircle,
} from "lucide-react";

interface ScopeGitIdentityProps {
  scope: ScopeWithLinks;
  onSetupIdentity: () => void;
}

export function ScopeGitIdentity({
  scope,
  onSetupIdentity,
}: ScopeGitIdentityProps) {
  const [loading, setLoading] = useState(false);
  const { gitConfigs, fetchGitConfig, refreshGitConfig } = useScopesStore();

  const gitConfig = gitConfigs.get(scope.scope.id);

  useEffect(() => {
    if (scope.scope.defaultFolder && !gitConfig) {
      fetchGitConfig(scope.scope.id);
    }
  }, [scope.scope.id, scope.scope.defaultFolder, gitConfig, fetchGitConfig]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshGitConfig(scope.scope.id);
    } catch (error) {
      console.error("Failed to refresh git config:", error);
    } finally {
      setLoading(false);
    }
  };

  // No default folder set
  if (!scope.scope.defaultFolder) {
    return (
      <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Set a default folder to configure git identity</span>
        </div>
      </div>
    );
  }

  // No git config found
  if (
    !gitConfig ||
    (!gitConfig.userName && !gitConfig.userEmail && !gitConfig.gpgSign)
  ) {
    return (
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>No Git Identity Configured</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Projects in this scope will use your global git config
            </p>
          </div>
          <button
            onClick={onSetupIdentity}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-[11px] font-medium",
              "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              "hover:bg-amber-500/20 transition-colors"
            )}
          >
            Setup
          </button>
        </div>
      </div>
    );
  }

  // GPG signing enabled but identity incomplete
  const hasIncompleteIdentity =
    gitConfig.gpgSign && (!gitConfig.userName || !gitConfig.userEmail);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-medium text-foreground/70 uppercase tracking-wider">
          Git Identity
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "hover:bg-black/5 dark:hover:bg-white/10",
              "disabled:opacity-50"
            )}
            title="Refresh"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground",
                loading && "animate-spin"
              )}
            />
          </button>
          <button
            onClick={onSetupIdentity}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "hover:bg-black/5 dark:hover:bg-white/10"
            )}
            title="Edit"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {hasIncompleteIdentity && (
        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span>GPG signing enabled but identity is incomplete</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {gitConfig.userName && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[13px] text-foreground/80">
              {gitConfig.userName}
            </span>
          </div>
        )}

        {gitConfig.userEmail && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[13px] text-foreground/80">
              {gitConfig.userEmail}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {gitConfig.gpgSign ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[12px] text-green-600 dark:text-green-400">
                GPG signing enabled
              </span>
            </>
          ) : (
            <>
              <ShieldOff className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[12px] text-muted-foreground/70">
                GPG signing disabled
              </span>
            </>
          )}
        </div>
      </div>

      {gitConfig.configFilePath && (
        <p className="text-[10px] text-muted-foreground/60 truncate">
          Config: {gitConfig.configFilePath}
        </p>
      )}
    </div>
  );
}

// Compact version for display in info panel
interface ScopeGitIdentityCompactProps {
  gitConfig: ScopeGitConfig | undefined;
}

export function ScopeGitIdentityCompact({
  gitConfig,
}: ScopeGitIdentityCompactProps) {
  if (!gitConfig || (!gitConfig.userName && !gitConfig.userEmail)) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-[12px]">
      {gitConfig.userName && (
        <div className="flex items-center gap-1.5 text-foreground/70">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{gitConfig.userName}</span>
        </div>
      )}
      {gitConfig.userEmail && (
        <div className="flex items-center gap-1.5 text-foreground/70">
          <Mail className="h-3 w-3" />
          <span className="truncate max-w-[150px]">{gitConfig.userEmail}</span>
        </div>
      )}
      {gitConfig.gpgSign && (
        <span title="GPG signing enabled">
          <ShieldCheck className="h-3 w-3 text-green-500" />
        </span>
      )}
    </div>
  );
}
