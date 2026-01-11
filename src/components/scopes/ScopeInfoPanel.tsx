import { useEffect, useState } from "react";
import {
  ExternalLink,
  Github,
  Link as LinkIcon,
  Settings,
  Plus,
  Code,
  FolderOpen,
  Calendar,
  AlertTriangle,
  Key,
  RefreshCw,
  GitBranch,
  User,
  Mail,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
} from "lucide-react";
import {
  JiraIcon,
  GitLabIcon,
  BitbucketIcon,
  ConfluenceIcon,
  NotionIcon,
  LinearIcon,
  SlackIcon,
} from "../icons/ServiceIcons";
import type { ScopeWithLinks, Editor } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { LINK_TYPES } from "../../types";
import { useScopesStore } from "../../stores/scopes";
import { useSettingsStore } from "../../stores/settings";

interface ScopeInfoPanelProps {
  scope: ScopeWithLinks;
  projectCount: number;
  defaultEditor?: Editor;
  onEditScope: () => void;
  onManageLinks: () => void;
  onShowFolderWarnings?: () => void;
  onSetupGitIdentity?: () => void;
}

export function ScopeInfoPanel({
  scope,
  projectCount,
  defaultEditor,
  onEditScope,
  onManageLinks,
  onShowFolderWarnings,
  onSetupGitIdentity,
}: ScopeInfoPanelProps) {
  const [scanning, setScanning] = useState(false);

  const { settings } = useSettingsStore();
  const {
    folderWarnings,
    gitConfigs,
    fetchFolderWarnings,
    fetchGitConfig,
    scanScopeFolder
  } = useScopesStore();

  const warnings = folderWarnings.get(scope.scope.id) || [];
  const gitConfig = gitConfigs.get(scope.scope.id);

  useEffect(() => {
    if (scope.scope.defaultFolder) {
      fetchFolderWarnings(scope.scope.id);
    }
    if (scope.scope.defaultFolder && settings.max_git_integration) {
      fetchGitConfig(scope.scope.id);
    }
  }, [scope.scope.id, scope.scope.defaultFolder, settings.max_git_integration, fetchFolderWarnings, fetchGitConfig]);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await scanScopeFolder(scope.scope.id);
      await fetchFolderWarnings(scope.scope.id);
    } finally {
      setScanning(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-2">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: scope.scope.color || "#6b7280" }}
          >
            <FolderOpen className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground/90 truncate">
              {scope.scope.name}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {projectCount} project{projectCount !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEditScope}
            title="Edit Scope"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>Created {formatDate(scope.scope.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Default Editor */}
      {defaultEditor && (
        <div className="px-2 py-3">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
            <Code className="h-3 w-3" />
            <span>Default Editor</span>
          </div>
          <p className="text-[13px] font-medium text-foreground/80">
            {defaultEditor.name}
          </p>
        </div>
      )}

      {/* Default Folder Section */}
      {scope.scope.defaultFolder && (
        <div className="px-2 py-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <FolderOpen className="h-3 w-3" />
              <span>Default Folder</span>
            </div>
            <div className="flex items-center gap-1">
              {warnings.length > 0 && onShowFolderWarnings && (
                <button
                  onClick={onShowFolderWarnings}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    "hover:bg-amber-500/20 transition-colors"
                  )}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {warnings.length}
                </button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleScanNow}
                disabled={scanning}
                title="Scan Now"
              >
                <RefreshCw className={cn("h-3 w-3 text-muted-foreground", scanning && "animate-spin")} />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-foreground/60 truncate">
            {scope.scope.defaultFolder.replace(/^\/Users\/[^/]+/, "~")}
          </p>
        </div>
      )}

      {/* SSH Alias Section */}
      {scope.scope.sshAlias && settings.max_ssh_integration && (
        <div className="px-2 py-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
            <Key className="h-3 w-3" />
            <span>SSH Alias</span>
          </div>
          <p className="text-[13px] font-medium text-foreground/80 font-mono">
            {scope.scope.sshAlias}
          </p>
        </div>
      )}

      {/* Git Identity Section */}
      {settings.max_git_integration && scope.scope.defaultFolder && (
        <div className="px-2 py-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              <span>Git Identity</span>
            </div>
            {onSetupGitIdentity && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onSetupGitIdentity}
                title="Configure"
              >
                <Settings className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
          {gitConfig && (gitConfig.userName || gitConfig.userEmail || gitConfig.gpgSign) ? (
            <div className="space-y-1.5">
              {gitConfig.gpgSign && (!gitConfig.userName || !gitConfig.userEmail) && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-1 rounded">
                  <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                  <span>Identity incomplete</span>
                </div>
              )}
              {gitConfig.userName && (
                <div className="flex items-center gap-1.5 text-[11px] text-foreground/70">
                  <User className="h-2.5 w-2.5" />
                  <span className="truncate">{gitConfig.userName}</span>
                </div>
              )}
              {gitConfig.userEmail && (
                <div className="flex items-center gap-1.5 text-[11px] text-foreground/70">
                  <Mail className="h-2.5 w-2.5" />
                  <span className="truncate">{gitConfig.userEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px]">
                {gitConfig.gpgSign ? (
                  <>
                    <ShieldCheck className="h-2.5 w-2.5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">GPG signing enabled</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-2.5 w-2.5 text-muted-foreground/50" />
                    <span className="text-muted-foreground/60">GPG signing disabled</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/60">
              No identity configured
            </p>
          )}
        </div>
      )}

      {/* Links Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-medium text-foreground/70 uppercase tracking-wider">
              Quick Links
            </h3>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onManageLinks}
              title="Manage Links"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>

          {scope.links.length === 0 ? (
            <div className="text-center py-6">
              <div className="h-10 w-10 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto mb-2">
                <LinkIcon className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-[12px] text-muted-foreground mb-2">
                No links added
              </p>
              <button
                onClick={onManageLinks}
                className={cn("text-[12px] text-primary hover:underline")}
              >
                Add your first link
              </button>
            </div>
          ) : (
            <div className="-mx-2 space-y-0.5">
              {scope.links.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function LinkCard({
  link,
}: {
  link: { id: string; linkType: string; label: string; url: string };
}) {
  const typeInfo = LINK_TYPES.find((t) => t.id === link.linkType);

  const getIcon = () => {
    switch (link.linkType) {
      case "github":
        return <Github className="h-4 w-4" />;
      case "gitlab":
        return <GitLabIcon className="h-4 w-4" />;
      case "bitbucket":
        return <BitbucketIcon className="h-4 w-4" />;
      case "jira":
        return <JiraIcon className="h-4 w-4" />;
      case "confluence":
        return <ConfluenceIcon className="h-4 w-4" />;
      case "notion":
        return <NotionIcon className="h-4 w-4" />;
      case "linear":
        return <LinearIcon className="h-4 w-4" />;
      case "slack":
        return <SlackIcon className="h-4 w-4" />;
      default:
        return <LinkIcon className="h-4 w-4" />;
    }
  };

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2.5 p-2 transition-all group rounded-lg",
        "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
          "bg-black/5 dark:bg-white/10 text-foreground/60"
        )}
      >
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground/80 truncate">
            {link.label}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="text-[10px] text-muted-foreground/60">
          {typeInfo?.label || "Link"}
        </span>
      </div>
    </a>
  );
}
