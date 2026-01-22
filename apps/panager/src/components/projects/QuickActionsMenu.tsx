import {
  ExternalLink,
  FolderOpen,
  Copy,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  Settings2,
  Star,
  Terminal,
  Trash2,
  FileCode2,
} from "lucide-react";
import type { Editor, ScopeWithLinks } from "../../types";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../ui/DropdownMenu";

interface QuickActionsMenuProps {
  editor?: Editor;
  editors?: Editor[];
  scopes?: ScopeWithLinks[];
  currentScopeId?: string;
  gitStatus?: {
    needsPull: boolean;
    needsPush: boolean;
    hasChanges: boolean;
  };
  isPinned: boolean;
  isInScopeDefaultFolder?: boolean;
  onOpen: () => void;
  onOpenWithEditor?: (editorId: string) => void;
  onRevealInFinder?: () => void;
  onCopyPath?: () => void;
  onRefreshGit?: () => void;
  onPull?: () => void;
  onPush?: () => void;
  onSettings?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onOpenTerminal?: () => void;
  onViewFiles?: () => void;
  onMoveToScope?: (scopeId: string) => void;
  onDelete?: () => void;
  onDeleteWithFolder?: () => void;
}

export function QuickActionsMenu({
  editor,
  editors = [],
  scopes = [],
  currentScopeId,
  gitStatus,
  isPinned,
  isInScopeDefaultFolder = false,
  onOpen,
  onOpenWithEditor,
  onRevealInFinder,
  onCopyPath,
  onRefreshGit,
  onPull,
  onPush,
  onSettings,
  onPin,
  onUnpin,
  onOpenTerminal,
  onViewFiles,
  onMoveToScope,
  onDelete,
  onDeleteWithFolder,
}: QuickActionsMenuProps) {
  const otherScopes = scopes.filter((s) => s.scope.id !== currentScopeId);

  return (
    <DropdownMenuContent
      align="end"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
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

      {onOpenTerminal && (
        <DropdownMenuItem onClick={onOpenTerminal}>
          <Terminal className="h-3.5 w-3.5 mr-2" />
          Open Terminal
        </DropdownMenuItem>
      )}

      {onViewFiles && (
        <DropdownMenuItem onClick={onViewFiles}>
          <FileCode2 className="h-3.5 w-3.5 mr-2" />
          View Files
        </DropdownMenuItem>
      )}

      {onCopyPath && (
        <DropdownMenuItem onClick={onCopyPath}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy Path
        </DropdownMenuItem>
      )}

      {onRefreshGit && (
        <DropdownMenuItem onClick={onRefreshGit}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Refresh Git Status
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      {gitStatus?.needsPull && onPull && (
        <DropdownMenuItem onClick={onPull}>
          <ArrowDown className="h-3.5 w-3.5 mr-2" />
          Pull
        </DropdownMenuItem>
      )}

      {gitStatus?.needsPush && onPush && (
        <DropdownMenuItem onClick={onPush}>
          <ArrowUp className="h-3.5 w-3.5 mr-2" />
          Push
        </DropdownMenuItem>
      )}

      {onSettings && (
        <DropdownMenuItem onClick={onSettings}>
          <Settings2 className="h-3.5 w-3.5 mr-2" />
          Settings
        </DropdownMenuItem>
      )}

      {isPinned && onUnpin && (
        <DropdownMenuItem onClick={onUnpin}>
          <Star className="h-3.5 w-3.5 mr-2" />
          Unpin
        </DropdownMenuItem>
      )}

      {!isPinned && onPin && (
        <DropdownMenuItem onClick={onPin}>
          <Star className="h-3.5 w-3.5 mr-2" />
          Pin
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

      {isInScopeDefaultFolder && onDeleteWithFolder ? (
        <DropdownMenuItem
          onClick={onDeleteWithFolder}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Remove
        </DropdownMenuItem>
      ) : onDelete ? (
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Remove from Scope
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  );
}
