import { Keyboard } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { Section, ShortcutRow, formatHotkey } from "../../common";

export function ShortcutsSettingsSection() {
  const { settings } = useSettingsStore();

  return (
    <div className="space-y-6">
      <Section title="Global" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow
            label="Open Panager"
            shortcut={formatHotkey(settings.global_hotkey)}
          />
        </div>
      </Section>

      <Section title="Navigation" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow label="Command Palette" shortcut={"\u2318K"} />
          <ShortcutRow label="Toggle Info Panel" shortcut={"\u2318B"} />
        </div>
      </Section>

      <Section title="General" icon={<Keyboard className="h-4 w-4" />}>
        <div className="space-y-1">
          <ShortcutRow label="Close Dialog / Cancel" shortcut="Esc" />
        </div>
      </Section>
    </div>
  );
}
