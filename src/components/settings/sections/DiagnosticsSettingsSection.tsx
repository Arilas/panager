import { useEffect } from "react";
import { Activity, Folder, GitBranch, Shield } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { useDiagnosticsStore } from "../../../stores/diagnostics";
import { Section, ToggleRow, ToggleSwitch } from "../../common";
import { SeverityIcon, SEVERITY_CONFIG } from "../../common/Severity";
import { cn } from "../../../lib/utils";
import type { RuleGroup, RuleMetadata } from "../../../types";

// Rule group metadata
const RULE_GROUP_INFO: Record<
  RuleGroup,
  { name: string; description: string; icon: typeof GitBranch }
> = {
  git: {
    name: "Git Configuration",
    description: "Identity, signing, and remote configuration",
    icon: GitBranch,
  },
  repo: {
    name: "Repository Health",
    description: "Branch state, conflicts, and sync status",
    icon: Activity,
  },
  project: {
    name: "Project Structure",
    description: "File structure and organization",
    icon: Folder,
  },
  security: {
    name: "Security",
    description: "Secrets, credentials, and access",
    icon: Shield,
  },
};

export function DiagnosticsSettingsSection() {
  const { settings, updateSetting } = useSettingsStore();
  const {
    ruleMetadata,
    fetchRuleMetadata,
    fetchDisabledRules,
    disableRule,
    enableRule,
    isRuleDisabled,
  } = useDiagnosticsStore();

  useEffect(() => {
    fetchRuleMetadata();
    fetchDisabledRules();
  }, [fetchRuleMetadata, fetchDisabledRules]);

  const getRulesInGroup = (group: RuleGroup): RuleMetadata[] => {
    return ruleMetadata.filter((rule) => rule.group === group);
  };

  const getEnabledCount = (group: RuleGroup): [number, number] => {
    const rules = getRulesInGroup(group);
    const enabled = rules.filter((rule) => !isRuleDisabled(rule.id)).length;
    return [enabled, rules.length];
  };

  const isMaxFeatureEnabled = (feature: string | null): boolean => {
    if (!feature) return true;
    if (feature === "max_git_integration") return settings.max_git_integration;
    if (feature === "max_ssh_integration") return settings.max_ssh_integration;
    return true;
  };

  const handleRuleToggle = async (ruleId: string) => {
    if (isRuleDisabled(ruleId)) {
      await enableRule(ruleId);
    } else {
      await disableRule(ruleId);
    }
  };

  const diagnosticsEnabled = settings.diagnostics_enabled !== false;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium">Diagnostics</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Automatically scan projects for configuration issues, security
          problems, and best practices.
        </p>
      </div>

      {/* Master Toggle */}
      <Section
        title="Background Scanning"
        icon={<Activity className="h-4 w-4" />}
      >
        <ToggleRow
          label="Enable Diagnostics"
          description="Automatically scan projects for issues on a regular interval."
          checked={diagnosticsEnabled}
          onChange={(checked) => updateSetting("diagnostics_enabled", checked)}
        />

        {diagnosticsEnabled && (
          <div className="mt-3 pl-3 border-l-2 border-primary/20">
            <label className="block text-[12px] text-muted-foreground mb-2">
              Scan Interval
            </label>
            <select
              value={settings.diagnostics_scan_interval || 300000}
              onChange={(e) =>
                updateSetting(
                  "diagnostics_scan_interval",
                  Number(e.target.value)
                )
              }
              className={cn(
                "h-9 px-3 rounded-md text-[13px]",
                "bg-white/60 dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-none focus:ring-2 focus:ring-primary/30"
              )}
            >
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
              <option value={900000}>15 minutes</option>
              <option value={3600000}>1 hour</option>
            </select>
          </div>
        )}
      </Section>

      {/* Rule Groups */}
      {diagnosticsEnabled && (
        <>
          {(Object.keys(RULE_GROUP_INFO) as RuleGroup[]).map((group) => {
            const groupInfo = RULE_GROUP_INFO[group];
            const rules = getRulesInGroup(group);
            const [enabled, total] = getEnabledCount(group);
            const GroupIcon = groupInfo.icon;

            if (rules.length === 0) return null;

            return (
              <Section
                key={group}
                title={groupInfo.name}
                subtitle={`${enabled}/${total} enabled`}
                icon={<GroupIcon className="h-4 w-4" />}
              >
                <div className="space-y-2">
                  {rules.map((rule) => {
                    const isEnabled = !isRuleDisabled(rule.id);
                    const featureDisabled = !isMaxFeatureEnabled(
                      rule.requiredFeature
                    );
                    const severityClass =
                      SEVERITY_CONFIG[rule.defaultSeverity].textColor;

                    return (
                      <RuleToggleRow
                        key={rule.id}
                        ruleId={rule.id}
                        description={rule.description}
                        checked={isEnabled && !featureDisabled}
                        disabled={featureDisabled}
                        disabledReason={
                          featureDisabled && rule.requiredFeature
                            ? `Requires ${rule.requiredFeature
                                .replace("max_", "")
                                .replace("_", " ")} in Max settings`
                            : undefined
                        }
                        severityIcon={
                          <SeverityIcon
                            severity={rule.defaultSeverity}
                            className={cn("h-3 w-3", severityClass)}
                          />
                        }
                        onChange={() => handleRuleToggle(rule.id)}
                      />
                    );
                  })}
                </div>
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
}

interface RuleToggleRowProps {
  ruleId: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  severityIcon: React.ReactNode;
  onChange: () => void;
}

function RuleToggleRow({
  ruleId,
  description,
  checked,
  disabled,
  disabledReason,
  severityIcon,
  onChange,
}: RuleToggleRowProps) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        checked && !disabled
          ? "bg-primary/10 border border-primary/20"
          : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
      )}
    >
      <ToggleSwitch checked={checked && !disabled} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-[11px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
            {ruleId}
          </code>
          {severityIcon}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {description}
        </div>
        {disabledReason && (
          <div className="text-[10px] text-amber-500 mt-1">{disabledReason}</div>
        )}
      </div>
    </button>
  );
}
