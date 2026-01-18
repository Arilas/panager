import { cn } from "../../../lib/utils";
import { Button } from "../../ui/Button";
import { Section, FormHint } from "../../common";
import { ScopeGitIdentity } from "../ScopeGitIdentity";
import { GitBranch, Key, Plus } from "lucide-react";
import type { ScopeWithLinks } from "../../../types";

interface IdentityTabProps {
  scope: ScopeWithLinks | null;
  sshAlias: string;
  setSshAlias: (value: string) => void;
  aliases: { host: string; hostName?: string | null }[];
  showGitIntegration: boolean;
  showSshIntegration: boolean;
  onSetupIdentity: () => void;
  onNewAlias: () => void;
}

export function IdentityTab({
  scope,
  sshAlias,
  setSshAlias,
  aliases,
  showGitIntegration,
  showSshIntegration,
  onSetupIdentity,
  onNewAlias,
}: IdentityTabProps) {
  return (
    <div className="space-y-6">
      {showGitIntegration && scope && (
        <Section title="Git Identity" icon={<GitBranch className="h-4 w-4" />}>
          <ScopeGitIdentity scope={scope} onSetupIdentity={onSetupIdentity} />
        </Section>
      )}

      {showSshIntegration && (
        <Section title="SSH Alias" icon={<Key className="h-4 w-4" />}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={sshAlias}
                onChange={(e) => setSshAlias(e.target.value)}
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
              Projects will be verified to use this SSH alias in their remote
              URLs
            </FormHint>
          </div>
        </Section>
      )}
    </div>
  );
}
