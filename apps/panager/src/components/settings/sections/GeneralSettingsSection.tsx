import { GitBranch } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { Section } from "../../common";
import { cn } from "../../../lib/utils";

export function GeneralSettingsSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="space-y-6">
      <Section
        title="Git Refresh Interval"
        icon={<GitBranch className="h-4 w-4" />}
      >
        <div className="flex items-center gap-3">
          <select
            value={settings.git_refresh_interval}
            onChange={(e) =>
              updateSetting("git_refresh_interval", Number(e.target.value))
            }
            className={cn(
              "h-9 px-3 rounded-md text-[13px]",
              "bg-white/60 dark:bg-white/5",
              "border border-black/10 dark:border-white/10",
              "focus:outline-hidden focus:ring-2 focus:ring-primary/30"
            )}
          >
            <option value={300000}>5 minutes</option>
            <option value={600000}>10 minutes</option>
            <option value={900000}>15 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={3600000}>1 hour</option>
          </select>
          <span className="text-[12px] text-muted-foreground">
            Auto-refresh git status
          </span>
        </div>
      </Section>
    </div>
  );
}
