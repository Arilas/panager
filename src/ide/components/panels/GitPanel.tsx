/**
 * Git Status Panel
 */

import { useEffect } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
  AlertTriangle,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { cn } from "../../../lib/utils";
import type { GitFileChange, GitFileStatus } from "../../types";
import { useState } from "react";

export function GitPanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const activePanel = useIdeStore((s) => s.activePanel);
  const { changes, branch, loading, loadGitStatus, selectFileForDiff, selectedFilePath } =
    useGitStore();

  // Refresh on panel open
  useEffect(() => {
    if (activePanel === "git" && projectContext) {
      loadGitStatus(projectContext.projectPath);
    }
  }, [activePanel, projectContext, loadGitStatus]);

  const handleRefresh = () => {
    if (projectContext) {
      loadGitStatus(projectContext.projectPath);
    }
  };

  const stagedChanges = changes.filter((c) => c.staged);
  const unstagedChanges = changes.filter(
    (c) => !c.staged && c.status !== "untracked"
  );
  const untrackedChanges = changes.filter((c) => c.status === "untracked");

  const handleFileClick = (file: GitFileChange) => {
    if (projectContext) {
      selectFileForDiff(projectContext.projectPath, file.path, file.staged);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Source Control
        </span>
        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-neutral-800 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5 text-neutral-500",
              loading && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Branch info */}
      {branch && (
        <div className="px-3 py-2 text-sm border-b border-neutral-800">
          <span className="text-neutral-400">On branch </span>
          <span className="font-medium text-neutral-200">{branch.name}</span>
        </div>
      )}

      {/* Changes */}
      <div className="flex-1 overflow-auto py-1">
        {loading && changes.length === 0 ? (
          <div className="px-3 py-4 text-sm text-neutral-500">Loading...</div>
        ) : changes.length === 0 ? (
          <div className="px-3 py-4 text-sm text-neutral-500">
            No changes detected
          </div>
        ) : (
          <>
            {/* Staged changes */}
            {stagedChanges.length > 0 && (
              <ChangeSection
                title="Staged Changes"
                changes={stagedChanges}
                onFileClick={handleFileClick}
                selectedPath={selectedFilePath}
              />
            )}

            {/* Unstaged changes */}
            {unstagedChanges.length > 0 && (
              <ChangeSection
                title="Changes"
                changes={unstagedChanges}
                onFileClick={handleFileClick}
                selectedPath={selectedFilePath}
              />
            )}

            {/* Untracked files */}
            {untrackedChanges.length > 0 && (
              <ChangeSection
                title="Untracked"
                changes={untrackedChanges}
                onFileClick={handleFileClick}
                selectedPath={selectedFilePath}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ChangeSectionProps {
  title: string;
  changes: GitFileChange[];
  onFileClick: (file: GitFileChange) => void;
  selectedPath: string | null;
}

function ChangeSection({
  title,
  changes,
  onFileClick,
  selectedPath,
}: ChangeSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800/50"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        {title}
        <span className="ml-1 text-neutral-500">({changes.length})</span>
      </button>

      {expanded && (
        <div>
          {changes.map((change) => (
            <div
              key={`${change.path}-${change.staged}`}
              onClick={() => onFileClick(change)}
              className={cn(
                "flex items-center gap-2 px-4 py-1 cursor-pointer text-sm",
                "hover:bg-neutral-800/50 transition-colors",
                selectedPath === change.path && "bg-neutral-800"
              )}
            >
              <StatusIcon status={change.status} />
              <span className="truncate flex-1">{getFileName(change.path)}</span>
              <span className="text-xs text-neutral-600 truncate max-w-[100px]">
                {getParentPath(change.path)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: GitFileStatus }) {
  switch (status) {
    case "added":
      return <FilePlus className="w-4 h-4 text-green-500 shrink-0" />;
    case "deleted":
      return <FileX className="w-4 h-4 text-red-500 shrink-0" />;
    case "modified":
      return <FilePen className="w-4 h-4 text-yellow-500 shrink-0" />;
    case "untracked":
      return <FileQuestion className="w-4 h-4 text-neutral-500 shrink-0" />;
    case "conflicted":
      return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case "renamed":
      return <FilePen className="w-4 h-4 text-blue-500 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-neutral-500 shrink-0" />;
  }
}

import { File } from "lucide-react";

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getParentPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}
