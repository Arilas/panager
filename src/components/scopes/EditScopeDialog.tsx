import { useState, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import { useEditorsStore } from "../../stores/editors";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { SCOPE_COLORS } from "../../types";
import type { ScopeWithLinks, TempProjectSettings, PackageManager } from "../../types";
import {
  Code,
  FolderOpen,
  RefreshCw,
  Settings2,
  GitBranch,
  Key,
  Plus,
  Link as LinkIcon,
  AlertTriangle,
  Trash2,
  Package,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { SshAliasDialog } from "../ssh/SshAliasDialog";
import { GitConfigDialog } from "../git/GitConfigDialog";
import { ScopeGitIdentity } from "./ScopeGitIdentity";
import { ScopeLinksContent } from "./ScopeLinksDialog";
import { NameField, ColorField, Section, FieldHint } from "./ScopeFormFields";
import { Input } from "../ui/Input";

interface EditScopeDialogProps {
  scope: ScopeWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteScope?: () => void;
}

export function EditScopeDialog({
  scope,
  open,
  onOpenChange,
  onDeleteScope,
}: EditScopeDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SCOPE_COLORS[0].value);
  const [defaultEditorId, setDefaultEditorId] = useState<string>("");
  const [defaultFolder, setDefaultFolder] = useState<string>("");
  const [folderScanInterval, setFolderScanInterval] = useState<number>(300000);
  const [sshAlias, setSshAlias] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showSshAliasDialog, setShowSshAliasDialog] = useState(false);
  const [showGitConfigDialog, setShowGitConfigDialog] = useState(false);

  // Temp project settings
  const [tempCleanupDays, setTempCleanupDays] = useState<number>(7);
  const [tempSetupGitIdentity, setTempSetupGitIdentity] = useState(false);
  const [tempPackageManager, setTempPackageManager] = useState<PackageManager>("npm");

  const { updateScope, scanScopeFolder } = useScopesStore();
  const { editors } = useEditorsStore();
  const { settings } = useSettingsStore();
  const { aliases, fetchAliases } = useSshStore();

  useEffect(() => {
    if (scope) {
      setName(scope.scope.name);
      setColor(scope.scope.color || SCOPE_COLORS[0].value);
      setDefaultEditorId(scope.scope.defaultEditorId || "");
      setDefaultFolder(scope.scope.defaultFolder || "");
      setFolderScanInterval(scope.scope.folderScanInterval || 300000);
      setSshAlias(scope.scope.sshAlias || "");
      // Temp project settings
      const tempSettings = scope.scope.tempProjectSettings;
      setTempCleanupDays(tempSettings?.cleanupDays ?? 7);
      setTempSetupGitIdentity(tempSettings?.setupGitIdentity ?? false);
      setTempPackageManager(tempSettings?.preferredPackageManager ?? "npm");
    }
  }, [scope]);

  // Fetch SSH aliases when dialog opens and SSH integration is enabled
  useEffect(() => {
    if (open && settings.max_ssh_integration) {
      fetchAliases();
    }
  }, [open, settings.max_ssh_integration, fetchAliases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !scope) return;

    setLoading(true);
    try {
      // Only include temp project settings if there's a default folder
      const tempSettings: TempProjectSettings | undefined = defaultFolder
        ? {
            cleanupDays: tempCleanupDays,
            setupGitIdentity: tempSetupGitIdentity,
            preferredPackageManager: tempPackageManager,
          }
        : undefined;

      await updateScope(
        scope.scope.id,
        name.trim(),
        color,
        undefined,
        defaultEditorId || undefined,
        defaultFolder || undefined,
        folderScanInterval,
        sshAlias || undefined,
        tempSettings
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update scope:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Default Folder for Scope",
      });
      if (selected && typeof selected === "string") {
        setDefaultFolder(selected);
      }
    } catch (error) {
      console.error("Failed to open folder dialog:", error);
    }
  };

  const handleScanNow = async () => {
    if (!scope || !defaultFolder) return;
    setScanning(true);
    try {
      const added = await scanScopeFolder(scope.scope.id);
      if (added.length > 0) {
        console.log(`Added ${added.length} new projects`);
      }
    } catch (error) {
      console.error("Failed to scan folder:", error);
    } finally {
      setScanning(false);
    }
  };

  const showMaxFeatures =
    settings.max_git_integration || settings.max_ssh_integration;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit Scope</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs.Root defaultValue="general" className="flex h-[400px]">
            <Tabs.List
              className={cn(
                "flex flex-col w-[140px] shrink-0",
                "border-r border-black/5 dark:border-white/5",
                "p-2"
              )}
            >
              <TabTrigger value="general">General</TabTrigger>
              <TabTrigger value="folder">Folder</TabTrigger>
              <TabTrigger value="links">Links</TabTrigger>
              {defaultFolder && <TabTrigger value="temp">Temp Projects</TabTrigger>}
              {showMaxFeatures && (
                <TabTrigger value="identity">Identity</TabTrigger>
              )}
              <div className="flex-1" />
              <TabTrigger value="danger" variant="danger">Danger</TabTrigger>
            </Tabs.List>

            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden w-0">
              <Tabs.Content value="general" className="px-6 pt-2 pb-6">
                <GeneralTab
                  name={name}
                  setName={setName}
                  color={color}
                  setColor={setColor}
                  defaultEditorId={defaultEditorId}
                  setDefaultEditorId={setDefaultEditorId}
                  editors={editors}
                />
              </Tabs.Content>

              <Tabs.Content value="folder" className="px-6 pt-2 pb-6">
                <FolderTab
                  defaultFolder={defaultFolder}
                  setDefaultFolder={setDefaultFolder}
                  folderScanInterval={folderScanInterval}
                  setFolderScanInterval={setFolderScanInterval}
                  onBrowse={handleBrowseFolder}
                  onScanNow={handleScanNow}
                  scanning={scanning}
                />
              </Tabs.Content>

              <Tabs.Content
                value="links"
                className="px-6 pt-2 pb-6 overflow-hidden"
              >
                <Section
                  title="Quick Links"
                  icon={<LinkIcon className="h-4 w-4" />}
                >
                  {scope && <ScopeLinksContent scope={scope} compact />}
                </Section>
              </Tabs.Content>

              {defaultFolder && (
                <Tabs.Content value="temp" className="px-6 pt-2 pb-6">
                  <TempProjectsTab
                    cleanupDays={tempCleanupDays}
                    setCleanupDays={setTempCleanupDays}
                    setupGitIdentity={tempSetupGitIdentity}
                    setSetupGitIdentity={setTempSetupGitIdentity}
                    packageManager={tempPackageManager}
                    setPackageManager={setTempPackageManager}
                    showGitIdentityOption={settings.max_git_integration}
                  />
                </Tabs.Content>
              )}

              {showMaxFeatures && (
                <Tabs.Content value="identity" className="px-6 pt-2 pb-6">
                  <IdentityTab
                    scope={scope}
                    sshAlias={sshAlias}
                    setSshAlias={setSshAlias}
                    aliases={aliases}
                    showGitIntegration={settings.max_git_integration}
                    showSshIntegration={settings.max_ssh_integration}
                    onSetupIdentity={() => setShowGitConfigDialog(true)}
                    onNewAlias={() => setShowSshAliasDialog(true)}
                  />
                </Tabs.Content>
              )}

              <Tabs.Content value="danger" className="px-6 pt-2 pb-6">
                <DangerTab
                  scopeName={scope?.scope.name || ""}
                  onDelete={onDeleteScope}
                />
              </Tabs.Content>
            </div>
          </Tabs.Root>

          <DialogFooter className="px-6 py-4 border-t border-black/5 dark:border-white/5">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              loading={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* SSH Alias Creation Dialog */}
      <SshAliasDialog
        open={showSshAliasDialog}
        onOpenChange={setShowSshAliasDialog}
        onCreated={(host) => {
          setSshAlias(host);
          fetchAliases();
        }}
      />

      {/* Git Config Dialog */}
      {scope && (
        <GitConfigDialog
          scope={scope}
          open={showGitConfigDialog}
          onOpenChange={setShowGitConfigDialog}
        />
      )}
    </Dialog>
  );
}

function TabTrigger({
  value,
  children,
  variant,
}: {
  value: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "px-3 py-2 text-[13px] rounded-md text-left",
        "transition-colors",
        variant === "danger"
          ? "text-red-500/70 hover:bg-red-500/5 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500"
          : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
        "data-[state=active]:font-medium"
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

// General Tab Content
interface GeneralTabProps {
  name: string;
  setName: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  defaultEditorId: string;
  setDefaultEditorId: (value: string) => void;
  editors: { id: string; name: string; isAvailable: boolean }[];
}

function GeneralTab({
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
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
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
          <FieldHint>
            Projects in this scope will open with this editor by default
          </FieldHint>
        </div>
      </Section>
    </div>
  );
}

// Folder Tab Content
interface FolderTabProps {
  defaultFolder: string;
  setDefaultFolder: (value: string) => void;
  folderScanInterval: number;
  setFolderScanInterval: (value: number) => void;
  onBrowse: () => void;
  onScanNow: () => void;
  scanning: boolean;
}

function FolderTab({
  defaultFolder,
  setDefaultFolder,
  folderScanInterval,
  setFolderScanInterval,
  onBrowse,
  onScanNow,
  scanning,
}: FolderTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Default Folder" icon={<FolderOpen className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={defaultFolder}
              onChange={(e) => setDefaultFolder(e.target.value)}
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
          <FieldHint>
            Git repositories in this folder will be automatically added to this
            scope
          </FieldHint>
        </div>
      </Section>

      {defaultFolder && (
        <Section title="Auto-Scan" icon={<RefreshCw className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select
                value={folderScanInterval}
                onChange={(e) => setFolderScanInterval(Number(e.target.value))}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-[13px]",
                  "bg-white dark:bg-white/5",
                  "border border-black/10 dark:border-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              >
                <option value={300000}>Every 5 minutes</option>
                <option value={900000}>Every 15 minutes</option>
                <option value={1800000}>Every 30 minutes</option>
                <option value={3600000}>Every hour</option>
                <option value={0}>Manual only</option>
              </select>
              <button
                type="button"
                onClick={onScanNow}
                disabled={scanning}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px]",
                  "bg-primary/10 text-primary",
                  "hover:bg-primary/20 transition-colors",
                  "disabled:opacity-50"
                )}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", scanning && "animate-spin")}
                />
                {scanning ? "Scanning..." : "Scan Now"}
              </button>
            </div>
            <FieldHint>
              Automatically scan the folder for new repositories
            </FieldHint>
          </div>
        </Section>
      )}
    </div>
  );
}

// Identity Tab Content (Git & SSH)
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

function IdentityTab({
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
              Projects will be verified to use this SSH alias in their remote
              URLs
            </FieldHint>
          </div>
        </Section>
      )}
    </div>
  );
}

// Danger Tab Content
interface DangerTabProps {
  scopeName: string;
  onDelete?: () => void;
}

function DangerTab({ scopeName, onDelete }: DangerTabProps) {
  return (
    <div className="space-y-6">
      <Section
        title="Delete Scope"
        icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
      >
        <div className="space-y-3">
          <p className="text-[13px] text-foreground/70">
            Permanently delete <span className="font-medium">{scopeName}</span>{" "}
            and remove all associated projects from tracking. This action cannot
            be undone.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Project files on disk will not be affected.
          </p>
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium",
              "bg-red-500/10 text-red-500",
              "hover:bg-red-500/20 transition-colors"
            )}
          >
            <Trash2 className="h-4 w-4" />
            Delete Scope
          </button>
        </div>
      </Section>
    </div>
  );
}

// Temp Projects Tab Content
interface TempProjectsTabProps {
  cleanupDays: number;
  setCleanupDays: (value: number) => void;
  setupGitIdentity: boolean;
  setSetupGitIdentity: (value: boolean) => void;
  packageManager: PackageManager;
  setPackageManager: (value: PackageManager) => void;
  showGitIdentityOption: boolean;
}

function TempProjectsTab({
  cleanupDays,
  setCleanupDays,
  setupGitIdentity,
  setSetupGitIdentity,
  packageManager,
  setPackageManager,
  showGitIdentityOption,
}: TempProjectsTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Temp Project Settings" icon={<Package className="h-4 w-4" />}>
        <div className="space-y-4">
          {/* Preferred Package Manager */}
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground block">
              Preferred Package Manager
            </label>
            <select
              value={packageManager}
              onChange={(e) => setPackageManager(e.target.value as PackageManager)}
              className={cn(
                "w-full px-3 py-2 rounded-md text-[13px]",
                "bg-white dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              <option value="npm">npm</option>
              <option value="yarn">yarn</option>
              <option value="pnpm">pnpm</option>
              <option value="bun">bun</option>
            </select>
            <FieldHint>
              Pre-selected when creating new temp projects in this scope
            </FieldHint>
          </div>

          {/* Auto-delete setting */}
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground block">
              Auto-delete after
            </label>
            <select
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
              className={cn(
                "w-full px-3 py-2 rounded-md text-[13px]",
                "bg-white dark:bg-white/5",
                "border border-black/10 dark:border-white/10",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              <option value={3}>3 days of inactivity</option>
              <option value={7}>7 days of inactivity</option>
              <option value={14}>14 days of inactivity</option>
              <option value={30}>30 days of inactivity</option>
              <option value={0}>Never auto-delete</option>
            </select>
            <FieldHint>
              Temp projects not opened within this period will be automatically deleted
            </FieldHint>
          </div>

          {/* Setup Git Identity option - only show if max_git_integration is enabled */}
          {showGitIdentityOption && (
            <div className="pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setSetupGitIdentity(!setupGitIdentity)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg text-left",
                  "transition-colors",
                  setupGitIdentity
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5",
                    setupGitIdentity ? "bg-primary" : "bg-black/20 dark:bg-white/20"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full bg-white shadow transition-transform",
                      setupGitIdentity ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </div>
                <div>
                  <div className="text-[13px] font-medium">Setup Git Identity</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Initialize git and apply scope's identity (user.name, user.email) to new temp projects
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
