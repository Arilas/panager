import { useState, useCallback } from "react";
import * as api from "../../../lib/tauri";

export function useProjectWorkspace(projectPath: string | undefined) {
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [loadingWorkspaceFiles, setLoadingWorkspaceFiles] = useState(false);

  const loadWorkspaceFiles = useCallback(async () => {
    if (!projectPath) return;

    setLoadingWorkspaceFiles(true);
    try {
      const files = await api.findWorkspaceFiles(projectPath);
      setWorkspaceFiles(files);
    } catch (error) {
      console.error("Failed to load workspace files:", error);
      setWorkspaceFiles([]);
    } finally {
      setLoadingWorkspaceFiles(false);
    }
  }, [projectPath]);

  return {
    workspaceFiles,
    loadingWorkspaceFiles,
    loadWorkspaceFiles,
  };
}
