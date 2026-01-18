import { useState } from "react";
import { Terminal, RefreshCw } from "lucide-react";
import { useSettingsStore } from "../../../stores/settings";
import { useTerminalsStore } from "../../../stores/terminals";
import { Section, SelectableCard } from "../../common";
import { Button } from "../../ui/Button";

export function TerminalsSettingsSection() {
  const { terminals, syncTerminals, getDefaultTerminal } = useTerminalsStore();
  const { settings, updateSetting } = useSettingsStore();
  const [syncing, setSyncing] = useState(false);

  const availableTerminals = terminals.filter((t) => t.isAvailable);
  const currentDefaultId =
    settings.default_terminal_id || getDefaultTerminal()?.id;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncTerminals();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Default Terminal" icon={<Terminal className="h-4 w-4" />}>
        <p className="text-[12px] text-muted-foreground mb-3">
          Used when opening terminals in project directories.
        </p>
        <div className="space-y-1.5">
          {availableTerminals.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">
              No terminals available
            </p>
          ) : (
            availableTerminals.map((terminal) => (
              <SelectableCard
                key={terminal.id}
                selected={currentDefaultId === terminal.id}
                onClick={() =>
                  updateSetting("default_terminal_id", terminal.id)
                }
                title={terminal.name}
                subtitle={terminal.command}
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
            {syncing ? "Scanning..." : "Rescan for Terminals"}
          </Button>
        </div>
      </Section>
    </div>
  );
}
