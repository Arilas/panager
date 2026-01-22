import { cn } from "../../../lib/utils";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Section, FormHint } from "../../common";
import { FolderOpen, RefreshCw } from "lucide-react";

interface FolderTabProps {
  defaultFolder: string;
  setDefaultFolder: (value: string) => void;
  folderScanInterval: number;
  setFolderScanInterval: (value: number) => void;
  onBrowse: () => void;
  onScanNow: () => void;
  scanning: boolean;
}

export function FolderTab({
  defaultFolder,
  setDefaultFolder,
  folderScanInterval,
  setFolderScanInterval,
  onBrowse,
  onScanNow,
  scanning,
}: FolderTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Default Folder" icon={<FolderOpen className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={defaultFolder}
              onChange={(e) => setDefaultFolder(e.target.value)}
              placeholder="Path to scope's project folder"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBrowse}
            >
              Browse
            </Button>
          </div>
          <FormHint>
            Git repositories in this folder will be automatically added to this
            scope
          </FormHint>
        </div>
      </Section>

      {defaultFolder && (
        <Section title="Auto-Scan" icon={<RefreshCw className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select
                value={folderScanInterval}
                onChange={(e) => setFolderScanInterval(Number(e.target.value))}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-[13px]",
                  "bg-white dark:bg-white/5",
                  "border border-black/10 dark:border-white/10",
                  "focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                )}
              >
                <option value={300000}>Every 5 minutes</option>
                <option value={900000}>Every 15 minutes</option>
                <option value={1800000}>Every 30 minutes</option>
                <option value={3600000}>Every hour</option>
                <option value={0}>Manual only</option>
              </select>
              <button
                type="button"
                onClick={onScanNow}
                disabled={scanning}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px]",
                  "bg-primary/10 text-primary",
                  "hover:bg-primary/20 transition-colors",
                  "disabled:opacity-50"
                )}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", scanning && "animate-spin")}
                />
                {scanning ? "Scanning..." : "Scan Now"}
              </button>
            </div>
            <FormHint>
              Automatically scan the folder for new repositories
            </FormHint>
          </div>
        </Section>
      )}
    </div>
  );
}
