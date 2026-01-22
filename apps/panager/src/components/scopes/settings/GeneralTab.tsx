import { cn } from "../../../lib/utils";
import { Section, FormHint } from "../../common";
import { NameField, ColorField } from "../ScopeFormFields";
import { Code, Settings2 } from "lucide-react";

interface GeneralTabProps {
  name: string;
  setName: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  defaultEditorId: string;
  setDefaultEditorId: (value: string) => void;
  editors: { id: string; name: string; isAvailable: boolean }[];
}

export function GeneralTab({
  name,
  setName,
  color,
  setColor,
  defaultEditorId,
  setDefaultEditorId,
  editors,
}: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Basic Info" icon={<Settings2 className="h-4 w-4" />}>
        <div className="space-y-4">
          <NameField value={name} onChange={setName} autoFocus />
          <ColorField value={color} onChange={setColor} />
        </div>
      </Section>

      <Section title="Default Editor" icon={<Code className="h-4 w-4" />}>
        <div className="space-y-2">
          <select
            value={defaultEditorId}
            onChange={(e) => setDefaultEditorId(e.target.value)}
            className={cn(
              "w-full px-3 py-2 rounded-md text-[13px]",
              "bg-white dark:bg-white/5",
              "border border-black/10 dark:border-white/10",
              "focus:outline-hidden focus:ring-2 focus:ring-primary/50",
              "appearance-none cursor-pointer"
            )}
          >
            <option value="">Use global default</option>
            {editors
              .filter((e) => e.isAvailable)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
          <FormHint>
            Projects in this scope will open with this editor by default
          </FormHint>
        </div>
      </Section>
    </div>
  );
}
