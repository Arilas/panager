import { cn } from "../../../lib/utils";
import { Section, FormHint, ToggleRow } from "../../common";
import { Package } from "lucide-react";
import type { PackageManager } from "../../../types";

interface TempProjectsTabProps {
  cleanupDays: number;
  setCleanupDays: (value: number) => void;
  setupGitIdentity: boolean;
  setSetupGitIdentity: (value: boolean) => void;
  packageManager: PackageManager;
  setPackageManager: (value: PackageManager) => void;
  showGitIdentityOption: boolean;
}

export function TempProjectsTab({
  cleanupDays,
  setCleanupDays,
  setupGitIdentity,
  setSetupGitIdentity,
  packageManager,
  setPackageManager,
  showGitIdentityOption,
}: TempProjectsTabProps) {
  return (
    <div className="space-y-6">
      <Section
        title="Temp Project Settings"
        icon={<Package className="h-4 w-4" />}
      >
        <div className="space-y-4">
          {/* Preferred Package Manager */}
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground block">
              Preferred Package Manager
            </label>
            <select
              value={packageManager}
              onChange={(e) =>
                setPackageManager(e.target.value as PackageManager)
              }
              className={cn(
                "w-full px-3 py-2 rounded-md text-[13px]",
                "bg-white dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-hidden focus:ring-2 focus:ring-primary/50"
              )}
            >
              <option value="npm">npm</option>
              <option value="yarn">yarn</option>
              <option value="pnpm">pnpm</option>
              <option value="bun">bun</option>
            </select>
            <FormHint>
              Pre-selected when creating new temp projects in this scope
            </FormHint>
          </div>

          {/* Auto-delete setting */}
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground block">
              Auto-delete after
            </label>
            <select
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
              className={cn(
                "w-full px-3 py-2 rounded-md text-[13px]",
                "bg-white dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-hidden focus:ring-2 focus:ring-primary/50"
              )}
            >
              <option value={3}>3 days of inactivity</option>
              <option value={7}>7 days of inactivity</option>
              <option value={14}>14 days of inactivity</option>
              <option value={30}>30 days of inactivity</option>
              <option value={0}>Never auto-delete</option>
            </select>
            <FormHint>
              Temp projects not opened within this period will be automatically
              deleted
            </FormHint>
          </div>

          {/* Setup Git Identity option - only show if max_git_integration is enabled */}
          {showGitIdentityOption && (
            <div className="pt-2 border-t border-black/5 dark:border-white/5">
              <ToggleRow
                label="Setup Git Identity"
                description="Initialize git and apply scope's identity (user.name, user.email) to new temp projects"
                checked={setupGitIdentity}
                onChange={setSetupGitIdentity}
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
