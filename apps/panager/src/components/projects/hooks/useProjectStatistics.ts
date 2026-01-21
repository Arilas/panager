import { useState, useCallback } from "react";
import { useProjectsStore } from "../../../stores/projects";
import type { ProjectStatistics } from "../../../types";

export function useProjectStatistics(
  projectId: string | undefined,
  projectPath: string | undefined
) {
  const [statistics, setStatistics] = useState<ProjectStatistics | null>(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  const { fetchProjectStatistics } = useProjectsStore();

  const loadStatistics = useCallback(async () => {
    if (!projectId || !projectPath) return;

    setLoadingStatistics(true);
    try {
      const stats = await fetchProjectStatistics(projectId, projectPath);
      setStatistics(stats);
    } catch (error) {
      console.error("Failed to load statistics:", error);
      setStatistics(null);
    } finally {
      setLoadingStatistics(false);
    }
  }, [projectId, projectPath, fetchProjectStatistics]);

  const resetStatistics = useCallback(() => {
    setStatistics(null);
  }, []);

  return {
    statistics,
    loadingStatistics,
    loadStatistics,
    resetStatistics,
  };
}
