import { useState } from "react";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";

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

interface GitTabProps {
  gitConfig: GitConfig | null;
  gitBranches: GitBranch[];
  defaultBranch: string;
  setDefaultBranch: (branch: string) => void;
  gitGcLoading: boolean;
  gitFetchLoading: boolean;
  onGitGc: () => void;
  onGitFetch: () => void;
}

export function GitTab({
  gitConfig,
  gitBranches,
  defaultBranch,
  setDefaultBranch,
  gitGcLoading,
  gitFetchLoading,
  onGitGc,
  onGitFetch,
}: GitTabProps) {
  const [branchSearch, setBranchSearch] = useState("");

  const filteredBranches = gitBranches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {gitConfig && (
        <>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Git User Name
            </label>
            <Input
              value={gitConfig.userName || ""}
              readOnly
              className="bg-black/5 dark:bg-white/5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Git User Email
            </label>
            <Input
              value={gitConfig.userEmail || ""}
              readOnly
              className="bg-black/5 dark:bg-white/5"
            />
          </div>

          {gitConfig.remotes.length > 0 && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground/70">
                Remote Origins
              </label>
              <div className="space-y-1">
                {gitConfig.remotes.map((remote) => (
                  <div
                    key={remote.name}
                    className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/5 text-[12px] font-mono"
                  >
                    <span className="font-medium">{remote.name}:</span>{" "}
                    {remote.url}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Default Branch
        </label>
        <Input
          value={branchSearch}
          onChange={(e) => setBranchSearch(e.target.value)}
          placeholder="Search branches..."
          className="mb-2"
        />
        <select
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-md text-[13px]",
            "bg-white dark:bg-white/5",
            "border border-black/10 dark:border-white/10",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
          size={Math.min(filteredBranches.length + 1, 8)}
        >
          <option value="">No default branch</option>
          {filteredBranches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.isCurrent && "✓ "}
              {branch.name}
              {branch.isRemote && " (remote)"}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          This is for reference only. The branch will not be switched
          automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="glass"
          onClick={onGitGc}
          disabled={gitGcLoading}
          className="flex-1"
        >
          {gitGcLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Run Git GC
            </>
          )}
        </Button>
        <Button
          variant="glass"
          onClick={onGitFetch}
          disabled={gitFetchLoading}
          className="flex-1"
        >
          {gitFetchLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Fetch from Remote
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
