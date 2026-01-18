/**
 * Status Bar - Bottom bar with file info
 */

import { GitBranch } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useGitStore } from "../../stores/git";

export function StatusBar() {
  const cursorPosition = useIdeStore((s) => s.cursorPosition);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const openFiles = useFilesStore((s) => s.openFiles);
  const branch = useGitStore((s) => s.branch);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="h-6 bg-neutral-950 border-t border-neutral-800 flex items-center px-2 text-xs text-neutral-500 shrink-0">
      {/* Left section - Git branch */}
      <div className="flex items-center gap-2">
        {branch && (
          <div className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            <span>{branch.name}</span>
            {(branch.ahead > 0 || branch.behind > 0) && (
              <span className="text-neutral-600">
                {branch.ahead > 0 && `↑${branch.ahead}`}
                {branch.behind > 0 && `↓${branch.behind}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section - File info */}
      <div className="flex items-center gap-4">
        {/* Cursor position */}
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}

        {/* Language */}
        {activeFile && (
          <span className="capitalize">{activeFile.language}</span>
        )}

        {/* Encoding */}
        <span>UTF-8</span>
      </div>
    </div>
  );
}
