/**
 * Content Area - Editor tabs and Monaco editor
 */

import { useFilesStore } from "../../stores/files";
import { EditorTabs } from "../editor/EditorTabs";
import { MonacoEditor } from "../editor/MonacoEditor";
import { FileCode2 } from "lucide-react";

export function ContentArea() {
  const openFiles = useFilesStore((s) => s.openFiles);
  const activeFilePath = useFilesStore((s) => s.activeFilePath);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-neutral-900">
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
  return (
    <div className="h-full flex flex-col items-center justify-center text-neutral-500">
      <FileCode2 className="w-16 h-16 mb-4 opacity-30" />
      <p className="text-lg font-medium">No file open</p>
      <p className="text-sm mt-1">
        Select a file from the explorer to view its contents
      </p>
      <div className="mt-6 text-xs space-y-1">
        <p>
          <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400">
            ⌘P
          </kbd>{" "}
          Quick Open
        </p>
        <p>
          <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400">
            ⌘⇧E
          </kbd>{" "}
          Explorer
        </p>
      </div>
    </div>
  );
}
