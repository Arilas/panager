import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  Circle,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Tag,
  RefreshCw,
  FolderOpen,
  Copy,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import type { ProjectWithStatus, Editor, ScopeWithLinks } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { useSettingsStore } from "../../stores/settings";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../ui/DropdownMenu";

interface ProjectCardProps {
  project: ProjectWithStatus;
  editor?: Editor;
  editors?: Editor[];
  scopes?: ScopeWithLinks[];
  currentScopeId?: string;
  onOpen: () => void;
  onOpenWithEditor?: (editorId: string) => void;
  onDelete: () => void;
  onRefreshGit: () => void;
  onPull: () => void;
  onPush: () => void;
  onRename?: () => void;
  onMoveToScope?: (scopeId: string) => void;
  onRevealInFinder?: () => void;
  onCopyPath?: () => void;
  onManageTags?: () => void;
}

export function ProjectCard({
  project,
  editor,
  editors = [],
  scopes = [],
  currentScopeId,
  onOpen,
  onOpenWithEditor,
  onDelete,
  onRefreshGit,
  onPull,
  onPush,
  onRename,
  onMoveToScope,
  onRevealInFinder,
  onCopyPath,
  onManageTags,
}: ProjectCardProps) {
  const { project: p, tags, gitStatus } = project;
  const otherScopes = scopes.filter((s) => s.scope.id !== currentScopeId);
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  const hasChanges = gitStatus?.hasUncommitted || gitStatus?.hasUntracked;
  const needsPull = (gitStatus?.behind ?? 0) > 0;
  const needsPush = (gitStatus?.ahead ?? 0) > 0;

  return (
    <div
      className={cn(
        "group p-3 transition-all cursor-pointer",
        useLiquidGlass
          ? "liquid-glass-card-scope"
          : [
              "rounded-lg",
              "bg-white/60 dark:bg-white/5",
              "border border-black/[0.06] dark:border-white/[0.08]",
              "hover:bg-white/80 dark:hover:bg-white/10",
              "hover:shadow-sm hover:border-black/10 dark:hover:border-white/10"
            ]
      )}
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-foreground/90 truncate">
            {p.name}
          </h3>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
            {p.path.replace(/^\/Users\/[^/]+/, "~")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onOpen}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Open in {editor?.name || "Editor"}
            </DropdownMenuItem>

            {editors.length > 1 && onOpenWithEditor && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Open with...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {editors
                    .filter((e) => e.isAvailable)
                    .map((e) => (
                      <DropdownMenuItem
                        key={e.id}
                        onClick={() => onOpenWithEditor(e.id)}
                      >
                        {e.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            <DropdownMenuSeparator />

            {onRevealInFinder && (
              <DropdownMenuItem onClick={onRevealInFinder}>
                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                Reveal in Finder
              </DropdownMenuItem>
            )}

            {onCopyPath && (
              <DropdownMenuItem onClick={onCopyPath}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Copy Path
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={onRefreshGit}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh Git Status
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onRename && (
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
            )}

            {onManageTags && (
              <DropdownMenuItem onClick={onManageTags}>
                <Tag className="h-3.5 w-3.5 mr-2" />
                Manage Tags
              </DropdownMenuItem>
            )}

            {otherScopes.length > 0 && onMoveToScope && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                  Move to Scope
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {otherScopes.map((scope) => (
                    <DropdownMenuItem
                      key={scope.scope.id}
                      onClick={() => onMoveToScope(scope.scope.id)}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full mr-2"
                        style={{
                          backgroundColor: scope.scope.color || "#6b7280",
                        }}
                      />
                      {scope.scope.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Remove from Scope
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Git Status */}
      {gitStatus && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span className="truncate max-w-[80px]">
              {gitStatus.branch || "detached"}
            </span>
          </div>

          {needsPull && (
            <div className="flex items-center gap-0.5 text-orange-500 dark:text-orange-400">
              <ArrowDown className="h-3 w-3" />
              <span>{gitStatus.behind}</span>
            </div>
          )}

          {needsPush && (
            <div className="flex items-center gap-0.5 text-blue-500 dark:text-blue-400">
              <ArrowUp className="h-3 w-3" />
              <span>{gitStatus.ahead}</span>
            </div>
          )}

          {hasChanges && (
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <Circle className="h-1.5 w-1.5 fill-current" />
              <span>Modified</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]",
                "bg-black/5 dark:bg-white/10 text-foreground/60"
              )}
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className={cn(
          "flex items-center gap-1 pt-2 border-t border-black/5 dark:border-white/5",
          "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 text-[11px]"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          {editor ? editor.name : "Open"}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefreshGit}
          className="h-7 w-7"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </Button>

        {needsPull && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPull}
            className="h-7 w-7 hover:bg-orange-500/10 text-orange-500"
            title="Pull"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        )}

        {needsPush && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPush}
            className="h-7 w-7 hover:bg-blue-500/10 text-blue-500"
            title="Push"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 hover:bg-red-500/10 text-red-500/70 hover:text-red-500"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
