import { Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { Editor } from "../../../types";

interface EditorTabProps {
  projectPath: string;
  selectedEditor: Editor | undefined;
  editorSupportsWorkspaces: boolean;
  useWorkspace: boolean;
  setUseWorkspace: (use: boolean) => void;
  workspaceFile: string;
  setWorkspaceFile: (file: string) => void;
  workspaceFiles: string[];
  loadingWorkspaceFiles: boolean;
}

export function EditorTab({
  projectPath,
  selectedEditor,
  editorSupportsWorkspaces,
  useWorkspace,
  setUseWorkspace,
  workspaceFile,
  setWorkspaceFile,
  workspaceFiles,
  loadingWorkspaceFiles,
}: EditorTabProps) {
  if (!editorSupportsWorkspaces) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {selectedEditor
          ? `${selectedEditor.name} does not support workspace files.`
          : "Select an editor that supports workspaces (e.g., VS Code, Cursor) to use this feature."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[12px] font-medium text-foreground/70">
          <input
            type="checkbox"
            checked={useWorkspace}
            onChange={(e) => {
              setUseWorkspace(e.target.checked);
              if (!e.target.checked) {
                setWorkspaceFile("");
              }
            }}
            className="rounded"
          />
          Open with selected workspace
        </label>
        <p className="text-[11px] text-muted-foreground">
          When enabled, the project will open using the selected workspace file
          instead of the project folder.
        </p>
      </div>

      {useWorkspace && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-foreground/70">
            Workspace File
          </label>
          {loadingWorkspaceFiles ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning for workspace files...
            </div>
          ) : workspaceFiles.length > 0 ? (
            <select
              value={workspaceFile}
              onChange={(e) => setWorkspaceFile(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-md text-[13px]",
                "bg-white dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              <option value="">Select workspace file...</option>
              {workspaceFiles.map((file) => {
                const relativePath = file.replace(projectPath + "/", "");
                return (
                  <option key={file} value={file}>
                    {relativePath}
                  </option>
                );
              })}
            </select>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No .code-workspace files found in this project.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
