import {
  ExternalLink,
  FolderOpen,
  Copy,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Settings2,
  Star,
  Terminal,
  Trash2,
} from "lucide-react";
import type { ProjectWithStatus, Editor } from "../../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../ui/DropdownMenu";

interface QuickActionsMenuProps {
  project: ProjectWithStatus;
  editor?: Editor;
  editors?: Editor[];
  gitStatus?: {
    needsPull: boolean;
    needsPush: boolean;
    hasChanges: boolean;
  };
  isPinned: boolean;
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
  onDelete?: () => void;
}

export function QuickActionsMenu({
  project,
  editor,
  editors = [],
  gitStatus,
  isPinned,
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
  onDelete,
}: QuickActionsMenuProps) {
  return (
    <DropdownMenuContent align="end">
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

      {onCopyPath && (
        <DropdownMenuItem onClick={onCopyPath}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy Path
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      {onRefreshGit && (
        <DropdownMenuItem onClick={onRefreshGit}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Refresh Git Status
        </DropdownMenuItem>
      )}

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

      <DropdownMenuSeparator />

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

      {onDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Remove
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );
}
