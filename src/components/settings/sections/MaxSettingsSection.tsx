import { GitBranch, Key, Sparkles } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { Section, ToggleRow } from "../../common";

export function MaxSettingsSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium">Max Features</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Enable advanced integrations for deeper git and SSH configuration
          management per scope.
        </p>
      </div>

      <Section title="Git Integration" icon={<GitBranch className="h-4 w-4" />}>
        <ToggleRow
          label="Deeper Git Integration"
          description="Read git config includeIf sections to detect identity per scope folder. Verify and fix repository configurations."
          checked={settings.max_git_integration}
          onChange={(checked) => updateSetting("max_git_integration", checked)}
        />
      </Section>

      <Section title="SSH Integration" icon={<Key className="h-4 w-4" />}>
        <ToggleRow
          label="Deeper SSH Integration"
          description="Read SSH config to detect host aliases. Create and manage SSH aliases per scope. Verify remote URLs use correct aliases."
          checked={settings.max_ssh_integration}
          onChange={(checked) => updateSetting("max_ssh_integration", checked)}
        />
      </Section>
    </div>
  );
}
