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
  Folder,
  Settings2,
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
  currentScopeHasDefaultFolder?: boolean;
  isSelected?: boolean;
  onOpen: () => void;
  onOpenWithEditor?: (editorId: string) => void;
  onDelete: () => void;
  onDeleteWithFolder?: () => void;
  onRefreshGit: () => void;
  onPull: () => void;
  onPush: () => void;
  onMoveToScope?: (scopeId: string) => void;
  onRevealInFinder?: () => void;
  onCopyPath?: () => void;
  onManageTags?: () => void;
  onSettings?: () => void;
}

export function ProjectListItem({
  project,
  editor,
  editors = [],
  scopes = [],
  currentScopeId,
  currentScopeHasDefaultFolder = false,
  isSelected = false,
  onOpen,
  onOpenWithEditor,
  onDelete,
  onDeleteWithFolder,
  onRefreshGit,
  onPull,
  onPush,
  onMoveToScope,
  onRevealInFinder,
  onCopyPath,
  onManageTags,
  onSettings,
}: ProjectListItemProps) {
  const { project: p, tags, gitStatus } = project;
  const otherScopes = scopes.filter((s) => s.scope.id !== currentScopeId);

  const hasChanges = gitStatus?.hasUncommitted || gitStatus?.hasUntracked;
  const needsPull = (gitStatus?.behind ?? 0) > 0;
  const needsPush = (gitStatus?.ahead ?? 0) > 0;
  const isClean = gitStatus && !needsPull && !needsPush && !hasChanges;

  // Format path to be more readable
  const displayPath = p.path
    .replace(/^\/Users\/[^/]+/, "~")
    .split("/")
    .slice(-2)
    .join("/");

  // Extract workspace name from workspace file path
  const workspaceName = p.workspaceFile
    ? p.workspaceFile
        .split("/")
        .pop()
        ?.replace(/\.code-workspace$/, "") || null
    : null;

  return (
    <div
      className={cn(
        "group flex gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
        "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]",
        "border border-transparent hover:border-black/[0.05] dark:hover:border-white/[0.05]",
        isSelected && "bg-black/[0.05] dark:bg-white/[0.05] border-black/[0.08] dark:border-white/[0.08]"
      )}
      onClick={onOpen}
    >
      {/* Icon */}
      <div className="shrink-0 pt-0.5">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            "bg-black/[0.04] dark:bg-white/[0.08]",
            isSelected && "bg-primary/10"
          )}
        >
          <Folder
            className={cn(
              "h-4 w-4 text-muted-foreground/60",
              isSelected && "text-primary"
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Tags + Status */}
        <div className="flex items-center gap-2 mb-1">
          {/* Project Name */}
          <h3 className="text-[14px] font-medium text-foreground/90 truncate">
            {p.name}
          </h3>

        {/* Workspace Badge */}
        {workspaceName && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
            {workspaceName}
          </span>
        )}

        {/* Temp Badge */}
        {p.isTemp && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
            Temp
          </span>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]",
                  "bg-black/[0.04] dark:bg-white/[0.08] text-foreground/60"
                )}
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground/60">
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status Indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {needsPull && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPull();
              }}
              className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium",
                "text-orange-600 dark:text-orange-400",
                "bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
              )}
              title={`${gitStatus?.behind} commits behind`}
            >
              <ArrowDown className="h-3 w-3" />
              {gitStatus?.behind}
            </button>
          )}

          {needsPush && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPush();
              }}
              className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium",
                "text-blue-600 dark:text-blue-400",
                "bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              )}
              title={`${gitStatus?.ahead} commits ahead`}
            >
              <ArrowUp className="h-3 w-3" />
              {gitStatus?.ahead}
            </button>
          )}

          {hasChanges && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10"
              title="Uncommitted changes"
            >
              <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
            </div>
          )}

          {isClean && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10"
              title="Clean"
            >
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Path + Branch + Actions */}
      <div className="flex items-center gap-2">
        {/* Path */}
        <span className="text-[12px] text-muted-foreground/60 truncate">
          {displayPath}
        </span>

        {/* Git Branch */}
        {gitStatus?.branch && (
          <div className="flex items-center gap-1 shrink-0 max-w-[200px]">
            <GitBranch className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {gitStatus.branch}
            </span>
          </div>
        )}

        {!gitStatus && (
          <span className="text-[11px] text-muted-foreground/40 italic">
            Not a git repo
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onOpen}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
              "scope-accent scope-accent-text",
              "transition-colors"
            )}
          >
            <ExternalLink className="h-3 w-3" />
            {editor?.name || "Open"}
          </button>

          <button
            onClick={onRefreshGit}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "text-muted-foreground/50 hover:text-muted-foreground",
              "hover:bg-black/5 dark:hover:bg-white/10"
            )}
            title="Refresh Git Status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  "text-muted-foreground/50 hover:text-muted-foreground",
                  "hover:bg-black/5 dark:hover:bg-white/10"
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
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

              {onSettings && (
                <DropdownMenuItem onClick={onSettings}>
                  <Settings2 className="h-3.5 w-3.5 mr-2" />
                  Settings
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

              {currentScopeHasDefaultFolder && onDeleteWithFolder ? (
                <DropdownMenuItem
                  onClick={onDeleteWithFolder}
                  className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remove
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remove from Scope
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </div>
    </div>
  );
}
