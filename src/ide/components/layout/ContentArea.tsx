/**
 * Content Area - Editor tabs and Monaco editor
 *
 * Styled with theme support to match Panager's design.
 */

import { useMemo } from "react";
import { useEditorStore } from "../../stores/editor";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { EditorTabs } from "../editor/EditorTabs";
import { MonacoEditor } from "../editor/MonacoEditor";
import { DiffEditor } from "../editor/DiffEditor";
import { FileCode2 } from "lucide-react";
import { cn } from "../../../lib/utils";

export function ContentArea() {
  const openTabs = useEditorStore((s) => s.openTabs);
  const previewTab = useEditorStore((s) => s.previewTab);
  const diffTab = useEditorStore((s) => s.diffTab);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const fileStates = useEditorStore((s) => s.fileStates);
  const { effectiveTheme, useLiquidGlass } = useIdeSettingsContext();

  // Check if diff tab is active
  const isDiffTabActive = activeTabPath?.startsWith("diff://") && diffTab;

  // Get the active file state (either from permanent tabs or preview)
  const activeFile = useMemo(() => {
    if (!activeTabPath) return null;
    // Don't return file state for diff tabs
    if (activeTabPath.startsWith("diff://")) return null;
    if (previewTab?.path === activeTabPath) return previewTab;
    return fileStates[activeTabPath] ?? null;
  }, [activeTabPath, previewTab, fileStates]);

  // Check if we have any tabs (permanent + preview + diff)
  const hasTabs = openTabs.length > 0 || previewTab !== null || diffTab !== null;

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
      {hasTabs && <EditorTabs />}

      {/* Editor or Welcome */}
      <div className="flex-1 min-h-0">
        {isDiffTabActive && diffTab ? (
          <DiffEditor
            original={diffTab.originalContent}
            modified={diffTab.modifiedContent}
            language={diffTab.language}
            path={diffTab.path}
          />
        ) : activeFile ? (
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
