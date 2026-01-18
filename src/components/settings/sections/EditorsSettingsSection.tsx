import { useState } from "react";
import { Code, RefreshCw } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { useEditorsStore } from "../../../stores/editors";
import { Section, SelectableCard } from "../../common";
import { Button } from "../../ui/Button";

export function EditorsSettingsSection() {
  const { editors, syncEditors, getDefaultEditor } = useEditorsStore();
  const { settings, updateSetting } = useSettingsStore();
  const [syncing, setSyncing] = useState(false);

  const availableEditors = editors.filter((e) => e.isAvailable);
  const currentDefaultId = settings.default_editor_id || getDefaultEditor()?.id;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEditors();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Default Editor" icon={<Code className="h-4 w-4" />}>
        <p className="text-[12px] text-muted-foreground mb-3">
          Used when opening projects without a specific editor preference.
        </p>
        <div className="space-y-1.5">
          {availableEditors.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">
              No editors available
            </p>
          ) : (
            availableEditors.map((editor) => (
              <SelectableCard
                key={editor.id}
                selected={currentDefaultId === editor.id}
                onClick={() => updateSetting("default_editor_id", editor.id)}
                title={editor.name}
                subtitle={editor.command}
              />
            ))
          )}
          <Button
            variant="secondary"
            onClick={handleSync}
            loading={syncing}
            className="w-full mt-2"
          >
            {!syncing && <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {syncing ? "Scanning..." : "Rescan for Editors"}
          </Button>
        </div>
      </Section>
    </div>
  );
}
