/**
 * Content Area - Editor tabs and Monaco editor
 *
 * Styled with theme support to match Panager's design.
 */

import { useFilesStore } from "../../stores/files";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { EditorTabs } from "../editor/EditorTabs";
import { MonacoEditor } from "../editor/MonacoEditor";
import { FileCode2 } from "lucide-react";
import { cn } from "../../../lib/utils";

export function ContentArea() {
  const openFiles = useFilesStore((s) => s.openFiles);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const { effectiveTheme, useLiquidGlass } = useIdeSettingsContext();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "flex-1 flex flex-col min-w-0",
        useLiquidGlass
          ? "liquid-glass-content"
          : isDark
            ? "bg-neutral-900/50"
            : "bg-white/50"
      )}
    >
      {/* Tabs */}
      {openFiles.length > 0 && <EditorTabs />}

      {/* Editor or Welcome */}
      <div className="flex-1 min-h-0">
        {activeFile ? (
          <MonacoEditor
            content={activeFile.content}
            language={activeFile.language}
            path={activeFile.path}
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}

function WelcomeScreen() {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <FileCode2 className="w-16 h-16 mb-4 opacity-30" />
      <p className="text-lg font-medium">No file open</p>
      <p className="text-sm mt-1">
        Select a file from the explorer to view its contents
      </p>
      <div className="mt-6 text-xs space-y-1">
        <p>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded",
              isDark
                ? "bg-neutral-800 text-neutral-400"
                : "bg-neutral-200 text-neutral-600"
            )}
          >
            ⌘P
          </kbd>{" "}
          Quick Open
        </p>
        <p>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded",
              isDark
                ? "bg-neutral-800 text-neutral-400"
                : "bg-neutral-200 text-neutral-600"
            )}
          >
            ⌘⇧E
          </kbd>{" "}
          Explorer
        </p>
      </div>
    </div>
  );
}
