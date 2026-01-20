/**
 * Content Area - Editor tabs and Monaco editor
 *
 * Styled with theme support to match Panager's design.
 */

import { useMemo } from "react";
import { useEditorStore, isFileTab, isDiffTab, isChatTab } from "../../stores/editor";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { EditorTabs } from "../editor/EditorTabs";
import { MonacoEditor } from "../editor/MonacoEditor";
import { DiffEditor } from "../editor/DiffEditor";
import { ChatTabContent } from "../agent/ChatTabContent";
import { FileCode2 } from "lucide-react";
import { cn } from "../../../lib/utils";

export function ContentArea() {
  const openTabs = useEditorStore((s) => s.openTabs);
  const previewTab = useEditorStore((s) => s.previewTab);
  const tabStates = useEditorStore((s) => s.tabStates);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const { effectiveTheme, useLiquidGlass } = useIdeSettingsContext();

  // Get the active tab state (either from permanent tabs or preview)
  const activeTab = useMemo(() => {
    if (!activeTabPath) return null;
    if (previewTab?.path === activeTabPath) return previewTab;
    return tabStates[activeTabPath] ?? null;
  }, [activeTabPath, previewTab, tabStates]);

  // Check if we have any tabs (permanent + preview)
  const hasTabs = openTabs.length > 0 || previewTab !== null;

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
        {isDiffTab(activeTab) ? (
          <DiffEditor
            original={activeTab.originalContent}
            modified={activeTab.modifiedContent}
            language={activeTab.language}
            path={activeTab.path}
          />
        ) : isFileTab(activeTab) ? (
          <MonacoEditor
            content={activeTab.content}
            language={activeTab.language}
            path={activeTab.path}
          />
        ) : isChatTab(activeTab) ? (
          <ChatTabContent
            sessionId={activeTab.sessionId}
            sessionName={activeTab.sessionName}
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
