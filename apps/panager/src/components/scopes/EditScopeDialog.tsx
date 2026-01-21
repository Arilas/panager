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
import type {
  ScopeWithLinks,
  TempProjectSettings,
  PackageManager,
} from "../../types";
import {
  FolderOpen,
  Settings2,
  Link as LinkIcon,
  AlertTriangle,
  Package,
  UserCircle,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { SshAliasDialog } from "../ssh/SshAliasDialog";
import { GitConfigDialog } from "../git/GitConfigDialog";
import { ScopeLinksContent } from "./ScopeLinksDialog";
import { Section, TabTrigger } from "../common";
import {
  GeneralTab,
  FolderTab,
  IdentityTab,
  TempProjectsTab,
  DangerTab,
} from "./settings";

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
  const [tempPackageManager, setTempPackageManager] =
    useState<PackageManager>("npm");

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
      setTempPackageManager(
        (tempSettings?.preferredPackageManager as PackageManager) ?? "npm"
      );
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

  const useLiquidGlass = settings.liquid_glass_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <form onSubmit={handleSubmit}>
          <Tabs.Root defaultValue="general" className="flex">
            <Tabs.List
              className={cn(
                "flex flex-col w-[180px] shrink-0",
                useLiquidGlass
                  ? "p-3 pt-10 liquid-glass-sidebar gap-1"
                  : "p-2 pt-6 border-r border-black/5 dark:border-white/5"
              )}
            >
              <TabTrigger
                value="general"
                icon={<Settings2 className="h-4 w-4" />}
              >
                General
              </TabTrigger>
              <TabTrigger
                value="folder"
                icon={<FolderOpen className="h-4 w-4" />}
              >
                Folder
              </TabTrigger>
              <TabTrigger value="links" icon={<LinkIcon className="h-4 w-4" />}>
                Links
              </TabTrigger>
              {defaultFolder && (
                <TabTrigger value="temp" icon={<Package className="h-4 w-4" />}>
                  Temp Projects
                </TabTrigger>
              )}
              {showMaxFeatures && (
                <TabTrigger
                  value="identity"
                  icon={<UserCircle className="h-4 w-4" />}
                >
                  Identity
                </TabTrigger>
              )}
              <div className="flex-1" />
              <TabTrigger
                value="danger"
                variant="danger"
                icon={<AlertTriangle className="h-4 w-4" />}
              >
                Danger
              </TabTrigger>
            </Tabs.List>

            <div className="flex-1 min-w-0 w-0 flex flex-col h-[460px]">
              <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                <DialogTitle>Edit Scope</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
              <DialogFooter className="px-6 py-4 border-t border-black/5 dark:border-white/5 shrink-0">
                <Button variant="glass" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!name.trim()}
                  loading={loading}
                  variant="glass-scope"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          </Tabs.Root>
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
