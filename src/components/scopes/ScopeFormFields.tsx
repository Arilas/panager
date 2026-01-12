import { cn } from "../../lib/utils";
import { Input } from "../ui/Input";
import { SCOPE_COLORS } from "../../types";
import type { SshAlias } from "../../types";
import { FolderOpen, Key, Plus } from "lucide-react";

// Shared field label component
export function FieldLabel({
  children,
  icon,
  optional,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="text-[12px] font-medium text-foreground/70 flex items-center gap-1.5">
      {icon}
      {children}
      {optional && (
        <span className="text-muted-foreground/60 font-normal">(optional)</span>
      )}
    </label>
  );
}

// Shared field hint/description
export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

// Name field
interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function NameField({ value, onChange, autoFocus }: NameFieldProps) {
  return (
    <div className="space-y-2">
      <FieldLabel>Name</FieldLabel>
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
      <FieldLabel>Color</FieldLabel>
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
      <FieldLabel
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        optional={optional}
      >
        Default Folder
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Path to scope's project folder"
          className="flex-1"
        />
        <button
          type="button"
          onClick={onBrowse}
          className={cn(
            "px-3 py-2 rounded-md text-[12px]",
            "bg-black/5 dark:bg-white/10",
            "hover:bg-black/10 dark:hover:bg-white/15",
            "transition-colors shrink-0"
          )}
        >
          Browse
        </button>
      </div>
      <FieldHint>{hint}</FieldHint>
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
      <FieldLabel icon={<Key className="h-3.5 w-3.5" />} optional={optional}>
        SSH Alias
      </FieldLabel>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "flex-1 px-3 py-2 rounded-md text-[13px]",
            "bg-white dark:bg-white/5",
            "border border-black/10 dark:border-white/10",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "appearance-none cursor-pointer"
          )}
        >
          <option value="">No SSH alias</option>
          {aliases.map((a) => (
            <option key={a.host} value={a.host}>
              {a.host} {a.hostName ? `(${a.hostName})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onNewAlias}
          className={cn(
            "flex items-center gap-1 px-3 py-2 rounded-md text-[12px]",
            "bg-black/5 dark:bg-white/10",
            "hover:bg-black/10 dark:hover:bg-white/15",
            "transition-colors shrink-0"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>
      <FieldHint>
        Projects will be verified to use this SSH alias in their remote URLs
      </FieldHint>
    </div>
  );
}

// Section container (similar to SettingsDialog)
export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-[13px] font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
