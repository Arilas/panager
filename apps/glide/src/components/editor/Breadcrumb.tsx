/**
 * Breadcrumb Component
 *
 * Shows the path to the current file as clickable segments.
 */

import { useMemo } from "react";
import { ChevronRight, FolderOpen, FileCode2 } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface BreadcrumbProps {
  path: string;
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const setActivePanel = useIdeStore((s) => s.setActivePanel);
  const setRevealFilePath = useFilesStore((s) => s.setRevealFilePath);
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  const isDark = effectiveTheme === "dark";

  // Parse path into segments relative to project root
  const segments = useMemo(() => {
    if (!projectContext?.projectPath) return [];

    const projectRoot = projectContext.projectPath;
    const relativePath = path.startsWith(projectRoot)
      ? path.slice(projectRoot.length + 1) // +1 for the trailing slash
      : path;

    const parts = relativePath.split("/").filter(Boolean);

    // Build full paths for each segment
    return parts.map((name, index) => ({
      name,
      fullPath: `${projectRoot}/${parts.slice(0, index + 1).join("/")}`,
      isLast: index === parts.length - 1,
    }));
  }, [path, projectContext?.projectPath]);

  // Handle clicking on a segment to reveal it in the sidebar
  const handleSegmentClick = (fullPath: string, isLast: boolean) => {
    if (isLast) return; // Don't do anything for the file itself

    // Ensure the files panel is active
    setActivePanel("files");

    // Trigger reveal via the files store (handled by useRevealActiveFile hook)
    // We reveal the clicked folder itself, which will expand all parents and scroll to it
    setRevealFilePath(fullPath);
  };

  if (segments.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-3 py-1 text-[11px] overflow-x-auto",
        "border-b border-black/5 dark:border-white/5",
        liquidGlass
          ? "bg-black/3 dark:bg-white/3"
          : isDark
            ? "bg-neutral-900/60"
            : "bg-neutral-100/60"
      )}
    >
      {segments.map((segment, index) => (
        <div key={segment.fullPath} className="flex items-center shrink-0">
          {index > 0 && (
            <ChevronRight
              className={cn(
                "w-3 h-3 mx-0.5",
                isDark ? "text-neutral-600" : "text-neutral-400"
              )}
            />
          )}
          <button
            onClick={() => handleSegmentClick(segment.fullPath, segment.isLast)}
            className={cn(
              "flex items-center gap-1 px-1 py-0.5 rounded",
              "transition-colors",
              segment.isLast
                ? [
                    isDark ? "text-neutral-200" : "text-neutral-700",
                    "cursor-default",
                  ]
                : [
                    isDark
                      ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                      : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5",
                    "cursor-pointer",
                  ]
            )}
          >
            {segment.isLast ? (
              <FileCode2 className="w-3 h-3 opacity-60" />
            ) : (
              <FolderOpen className="w-3 h-3 opacity-60" />
            )}
            <span>{segment.name}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
