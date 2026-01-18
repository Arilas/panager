import { Loader2 } from "lucide-react";
import { formatRelativeTime } from "../../../lib/utils";
import type { ProjectStatistics } from "../../../types";

interface StatisticsTabProps {
  statistics: ProjectStatistics | null;
  loading: boolean;
}

export function StatisticsTab({ statistics, loading }: StatisticsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!statistics) {
    return (
      <p className="text-[13px] text-muted-foreground py-4">
        Statistics not available
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {statistics.fileCount !== null && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">
              File Count
            </label>
            <p className="text-[13px]">
              {statistics.fileCount.toLocaleString()}
            </p>
          </div>
        )}
        {statistics.repoSizeBytes !== null && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">
              Repository Size
            </label>
            <p className="text-[13px]">
              {(statistics.repoSizeBytes / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}
        {statistics.commitCount !== null && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">
              Commits
            </label>
            <p className="text-[13px]">
              {statistics.commitCount.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {statistics.lastCommit && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-foreground/70">
            Last Commit
          </label>
          <div className="p-3 rounded-md bg-black/5 dark:bg-white/5">
            <p className="text-[12px] font-mono text-muted-foreground mb-1">
              {statistics.lastCommit.hash.slice(0, 8)}
            </p>
            <p className="text-[13px] mb-1">{statistics.lastCommit.message}</p>
            <p className="text-[11px] text-muted-foreground">
              {statistics.lastCommit.author} •{" "}
              {formatRelativeTime(statistics.lastCommit.date)}
            </p>
          </div>
        </div>
      )}

      {statistics.languages.length > 0 && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-foreground/70">
            Languages
          </label>
          <div className="space-y-1">
            {statistics.languages.map((lang) => (
              <div
                key={lang.name}
                className="flex items-center justify-between text-[12px]"
              >
                <span>{lang.name}</span>
                <span className="text-muted-foreground">
                  {lang.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {statistics.contributors.length > 0 && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-foreground/70">
            Contributors
          </label>
          <div className="space-y-1">
            {statistics.contributors.map((contrib, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[12px]"
              >
                <span>{contrib.name}</span>
                <span className="text-muted-foreground">
                  {contrib.commitCount} commits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
