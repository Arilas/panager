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
  ArrowRightLeft,
  ChevronRight,
} from "lucide-react";
import type { ProjectWithStatus, Editor, ScopeWithLinks } from "../../types";
import { cn } from "../../lib/utils";
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

interface ProjectListItemProps {
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
  onMoveToScope?: (scopeId: string) => void;
  onRevealInFinder?: () => void;
  onCopyPath?: () => void;
  onManageTags?: () => void;
}

export function ProjectListItem({
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
  onMoveToScope,
  onRevealInFinder,
  onCopyPath,
  onManageTags,
}: ProjectListItemProps) {
  const { project: p, tags, gitStatus } = project;
  const otherScopes = scopes.filter((s) => s.scope.id !== currentScopeId);

  const hasChanges = gitStatus?.hasUncommitted || gitStatus?.hasUntracked;
  const needsPull = (gitStatus?.behind ?? 0) > 0;
  const needsPush = (gitStatus?.ahead ?? 0) > 0;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer",
        "hover:bg-white/60 dark:hover:bg-white/5",
        "border border-transparent hover:border-black/[0.06] dark:hover:border-white/[0.08]"
      )}
      onClick={onOpen}
    >
      {/* Project Name & Path */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-medium text-foreground/90 truncate">
            {p.name}
          </h3>
          {p.isTemp && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400">
              Temp
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/70 truncate">
          {p.path.replace(/^\/Users\/[^/]+/, "~")}
        </p>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1">
          {tags.slice(0, 2).map((tag) => (
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
          {tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Git Status */}
      <div className="flex items-center gap-3 min-w-[180px]">
        {gitStatus ? (
          <>
            {/* Branch */}
            <div className="flex items-center gap-1.5 min-w-[100px]">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] text-foreground/70 truncate max-w-[80px]">
                {gitStatus.branch || "detached"}
              </span>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-2">
              {needsPull && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPull();
                  }}
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px]",
                    "text-orange-500 dark:text-orange-400",
                    "hover:bg-orange-500/10 transition-colors"
                  )}
                  title={`${gitStatus.behind} commits behind`}
                >
                  <ArrowDown className="h-3 w-3" />
                  <span>{gitStatus.behind}</span>
                </button>
              )}

              {needsPush && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPush();
                  }}
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px]",
                    "text-blue-500 dark:text-blue-400",
                    "hover:bg-blue-500/10 transition-colors"
                  )}
                  title={`${gitStatus.ahead} commits ahead`}
                >
                  <ArrowUp className="h-3 w-3" />
                  <span>{gitStatus.ahead}</span>
                </button>
              )}

              {hasChanges && (
                <div
                  className="flex items-center gap-1 text-amber-500 dark:text-amber-400"
                  title="Has uncommitted changes"
                >
                  <Circle className="h-2 w-2 fill-current" />
                </div>
              )}

              {!needsPull && !needsPush && !hasChanges && (
                <div className="flex items-center gap-1 text-green-500 dark:text-green-400">
                  <Circle className="h-2 w-2 fill-current" />
                </div>
              )}
            </div>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">No git</span>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onOpen}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium",
            "bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          )}
        >
          <ExternalLink className="h-3 w-3" />
          {editor?.name || "Open"}
        </button>

        <button
          onClick={onRefreshGit}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "hover:bg-black/5 dark:hover:bg-white/10"
          )}
          title="Refresh Git Status"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "p-1.5 rounded-md transition-colors",
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

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
