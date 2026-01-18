/**
 * Editor Tabs Component
 */

import { X, File } from "lucide-react";
import { useFilesStore } from "../../stores/files";
import { cn } from "../../../lib/utils";

export function EditorTabs() {
  const openFiles = useFilesStore((s) => s.openFiles);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const setActiveFile = useFilesStore((s) => s.setActiveFile);
  const closeFile = useFilesStore((s) => s.closeFile);

  return (
    <div className="flex bg-neutral-950 border-b border-neutral-800 overflow-x-auto shrink-0">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        const fileName = file.path.split("/").pop() || file.path;

        return (
          <div
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            className={cn(
              "group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border-r border-neutral-800",
              "transition-colors min-w-0 max-w-[200px]",
              isActive
                ? "bg-neutral-900 text-neutral-100"
                : "bg-neutral-950 text-neutral-500 hover:text-neutral-300"
            )}
          >
            <File className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={cn(
                "p-0.5 rounded hover:bg-neutral-700 transition-colors shrink-0",
                "opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
