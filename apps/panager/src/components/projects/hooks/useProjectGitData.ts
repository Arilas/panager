import { useState, useCallback } from "react";
import * as api from "../../../lib/tauri";

interface GitConfig {
  userName: string | null;
  userEmail: string | null;
  remotes: Array<{ name: string; url: string }>;
}

interface GitBranch {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
}

export function useProjectGitData(projectPath: string | undefined) {
  const [gitBranches, setGitBranches] = useState<GitBranch[]>([]);
  const [gitConfig, setGitConfig] = useState<GitConfig | null>(null);
  const [gitGcLoading, setGitGcLoading] = useState(false);
  const [gitFetchLoading, setGitFetchLoading] = useState(false);

  const loadGitData = useCallback(async () => {
    if (!projectPath) return;

    try {
      const [branches, config] = await Promise.all([
        api.getGitBranches(projectPath).catch(() => []),
        api.getGitConfig(projectPath).catch(() => null),
      ]);
      setGitBranches(branches);
      setGitConfig(config);
    } catch (error) {
      console.error("Failed to load git data:", error);
    }
  }, [projectPath]);

  const handleGitGc = useCallback(async () => {
    if (!projectPath) return;

    setGitGcLoading(true);
    try {
      await api.gitGc(projectPath);
    } catch (error) {
      console.error("Git GC failed:", error);
    } finally {
      setGitGcLoading(false);
    }
  }, [projectPath]);

  const handleGitFetch = useCallback(async () => {
    if (!projectPath) return;

    setGitFetchLoading(true);
    try {
      await api.gitFetch(projectPath);
      await loadGitData();
    } catch (error) {
      console.error("Git fetch failed:", error);
    } finally {
      setGitFetchLoading(false);
    }
  }, [projectPath, loadGitData]);

  return {
    gitBranches,
    gitConfig,
    gitGcLoading,
    gitFetchLoading,
    loadGitData,
    handleGitGc,
    handleGitFetch,
  };
}
