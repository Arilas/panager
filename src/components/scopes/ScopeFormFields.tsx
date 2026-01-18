import { cn } from "../../lib/utils";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { SCOPE_COLORS } from "../../types";
import type { SshAlias } from "../../types";
import { FolderOpen, Key, Plus } from "lucide-react";
import { FormLabel, FormHint, FormSelect } from "../common";

// Name field
interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function NameField({ value, onChange, autoFocus }: NameFieldProps) {
  return (
    <div className="space-y-2">
      <FormLabel>Name</FormLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Personal, Work, Side Projects"
        autoFocus={autoFocus}
      />
    </div>
  );
}

// Color picker field
interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ value, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <FormLabel>Color</FormLabel>
      <div className="flex flex-wrap gap-3 p-2">
        {SCOPE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              "h-7 w-7 rounded-full transition-all",
              "ring-offset-2 ring-offset-background",
              value === c.value
                ? "ring-2 ring-primary scale-110"
                : "hover:scale-105"
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
    </div>
  );
}

// Default folder field
interface FolderFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
  optional?: boolean;
  hint?: string;
}

export function FolderField({
  value,
  onChange,
  onBrowse,
  optional,
  hint = "Repos in this folder will be auto-added to scope",
}: FolderFieldProps) {
  return (
    <div className="space-y-2">
      <FormLabel
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        optional={optional}
      >
        Default Folder
      </FormLabel>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Path to scope's project folder"
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="sm" onClick={onBrowse}>
          Browse
        </Button>
      </div>
      <FormHint>{hint}</FormHint>
    </div>
  );
}

// SSH alias selector field
interface SshAliasFieldProps {
  value: string;
  onChange: (value: string) => void;
  aliases: SshAlias[];
  onNewAlias: () => void;
  optional?: boolean;
}

export function SshAliasField({
  value,
  onChange,
  aliases,
  onNewAlias,
  optional,
}: SshAliasFieldProps) {
  return (
    <div className="space-y-2">
      <FormLabel icon={<Key className="h-3.5 w-3.5" />} optional={optional}>
        SSH Alias
      </FormLabel>
      <div className="flex gap-2">
        <FormSelect
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        >
          <option value="">No SSH alias</option>
          {aliases.map((a) => (
            <option key={a.host} value={a.host}>
              {a.host} {a.hostName ? `(${a.hostName})` : ""}
            </option>
          ))}
        </FormSelect>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onNewAlias}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
      <FormHint>
        Projects will be verified to use this SSH alias in their remote URLs
      </FormHint>
    </div>
  );
}

