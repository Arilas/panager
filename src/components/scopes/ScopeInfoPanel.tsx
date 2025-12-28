import {
  ExternalLink,
  Github,
  Link as LinkIcon,
  Settings,
  Plus,
  Code,
  FolderOpen,
  Calendar,
  Trash2,
} from "lucide-react";
import type { ScopeWithLinks, Editor } from "../../types";
import { cn } from "../../lib/utils";
import { LINK_TYPES } from "../../types";

interface ScopeInfoPanelProps {
  scope: ScopeWithLinks;
  projectCount: number;
  defaultEditor?: Editor;
  onEditScope: () => void;
  onManageLinks: () => void;
  onDeleteScope: () => void;
}

export function ScopeInfoPanel({
  scope,
  projectCount,
  defaultEditor,
  onEditScope,
  onManageLinks,
  onDeleteScope,
}: ScopeInfoPanelProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4">
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
          <button
            onClick={onEditScope}
            className={cn(
              "p-2 rounded-md transition-colors",
              "hover:bg-black/5 dark:hover:bg-white/10"
            )}
            title="Edit Scope"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
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
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
            <Code className="h-3 w-3" />
            <span>Default Editor</span>
          </div>
          <p className="text-[13px] font-medium text-foreground/80">
            {defaultEditor.name}
          </p>
        </div>
      )}

      {/* Links Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-medium text-foreground/70 uppercase tracking-wider">
              Quick Links
            </h3>
            <button
              onClick={onManageLinks}
              className={cn(
                "p-1 rounded transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/10"
              )}
              title="Manage Links"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
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
                className={cn(
                  "text-[12px] text-primary hover:underline"
                )}
              >
                Add your first link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {scope.links.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4">
        <button
          onClick={onDeleteScope}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium",
            "text-red-500 hover:bg-red-500/10",
            "transition-colors"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Scope
        </button>
      </div>
    </div>
  );
}

function LinkCard({ link }: { link: { id: string; linkType: string; label: string; url: string } }) {
  const typeInfo = LINK_TYPES.find((t) => t.id === link.linkType);

  const getIcon = () => {
    switch (link.linkType) {
      case "github":
      case "gitlab":
      case "bitbucket":
        return <Github className="h-4 w-4" />;
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
        "flex items-center gap-3 p-3 rounded-lg transition-all",
        "bg-black/[0.02] dark:bg-white/[0.02]",
        "border border-black/5 dark:border-white/5",
        "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]",
        "hover:border-black/10 dark:hover:border-white/10",
        "group"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-md flex items-center justify-center",
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
