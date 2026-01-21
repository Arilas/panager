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
import { useProjectsStore } from "../../stores/projects";
import { useEditorsStore } from "../../stores/editors";
import { useSettingsStore } from "../../stores/settings";
import { TabTrigger } from "../common";
import type { ProjectWithStatus } from "../../types";
import { ProjectLinksSection } from "./ProjectLinksSection";
import {
  Settings2,
  GitBranch,
  Code,
  Tag,
  FileText,
  Link as LinkIcon,
  BarChart3,
  Terminal,
} from "lucide-react";
import {
  GeneralTab,
  NotesTab,
  StatisticsTab,
  CommandsTab,
  GitTab,
  EditorTab,
  TagsTab,
} from "./settings";
import {
  useProjectGitData,
  useProjectCommands,
  useProjectStatistics,
  useProjectWorkspace,
} from "./hooks";

interface ProjectSettingsDialogProps {
  project: ProjectWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
}: ProjectSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [name, setName] = useState("");
  const [preferredEditorId, setPreferredEditorId] = useState<string>("");
  const [defaultBranch, setDefaultBranch] = useState<string>("");
  const [workspaceFile, setWorkspaceFile] = useState<string>("");
  const [useWorkspace, setUseWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const {
    updateProject,
    updateProjectNotes,
    updateProjectDescription,
    assignProjectToGroup,
  } = useProjectsStore();
  const { editors } = useEditorsStore();
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  const selectedEditor = editors.find((e) => e.id === preferredEditorId);
  const editorSupportsWorkspaces = selectedEditor?.supportsWorkspaces ?? false;

  // Custom hooks for data management
  const gitData = useProjectGitData(project?.project.path);
  const commandsData = useProjectCommands(project?.project.id);
  const statisticsData = useProjectStatistics(
    project?.project.id,
    project?.project.path
  );
  const workspaceData = useProjectWorkspace(project?.project.path);

  // Load project data when dialog opens
  useEffect(() => {
    if (open && project) {
      setName(project.project.name);
      setPreferredEditorId(project.project.preferredEditorId || "");
      setDefaultBranch(project.project.defaultBranch || "");
      setWorkspaceFile(project.project.workspaceFile || "");
      setUseWorkspace(!!project.project.workspaceFile);
      setDescription(project.project.description || "");
      setNotes(project.project.notes || "");
      setSelectedGroupId(project.project.groupId || "");
      setActiveTab("general");
      statisticsData.resetStatistics();
    }
  }, [open, project]);

  // Load git data when Git tab is opened
  useEffect(() => {
    if (activeTab === "git" && project && open) {
      gitData.loadGitData();
    }
  }, [activeTab, project, open]);

  // Load workspace files when Editor tab is opened
  useEffect(() => {
    if (activeTab === "editor" && project && open && editorSupportsWorkspaces) {
      workspaceData.loadWorkspaceFiles();
    }
  }, [activeTab, project, open, editorSupportsWorkspaces]);

  // Load statistics when Statistics tab is opened
  useEffect(() => {
    if (activeTab === "statistics" && project && open) {
      statisticsData.loadStatistics();
    }
  }, [activeTab, project, open]);

  // Load commands when Commands tab is opened
  useEffect(() => {
    if (activeTab === "commands" && project && open) {
      commandsData.loadCommands();
    }
  }, [activeTab, project, open]);

  const handleSave = async () => {
    if (!project) return;

    setSaving(true);
    try {
      await Promise.all([
        updateProject(
          project.project.id,
          name,
          preferredEditorId || undefined,
          defaultBranch || undefined,
          useWorkspace && workspaceFile ? workspaceFile : undefined
        ),
        updateProjectDescription(project.project.id, description || null),
        updateProjectNotes(project.project.id, notes || null),
        assignProjectToGroup(project.project.id, selectedGroupId || null),
      ]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save project settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        {!useLiquidGlass && (
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
        )}
        <Tabs.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-[460px]"
        >
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              useLiquidGlass
                ? "p-3 liquid-glass-sidebar gap-1 pt-10"
                : "p-2 pt-6 border-r border-black/5 dark:border-white/5"
            )}
          >
            <TabTrigger
              value="general"
              icon={<Settings2 className="h-4 w-4" />}
            >
              General
            </TabTrigger>
            <TabTrigger value="notes" icon={<FileText className="h-4 w-4" />}>
              Notes
            </TabTrigger>
            <TabTrigger value="links" icon={<LinkIcon className="h-4 w-4" />}>
              Links
            </TabTrigger>
            <TabTrigger
              value="statistics"
              icon={<BarChart3 className="h-4 w-4" />}
            >
              Statistics
            </TabTrigger>
            <TabTrigger
              value="commands"
              icon={<Terminal className="h-4 w-4" />}
            >
              Commands
            </TabTrigger>
            <TabTrigger value="git" icon={<GitBranch className="h-4 w-4" />}>
              Git
            </TabTrigger>
            <TabTrigger value="editor" icon={<Code className="h-4 w-4" />}>
              Editor
            </TabTrigger>
            <TabTrigger value="tags" icon={<Tag className="h-4 w-4" />}>
              Tags
            </TabTrigger>
          </Tabs.List>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {useLiquidGlass && (
                <DialogHeader className="px-6 pt-4 pb-2 shrink-0 sticky top-0 z-50 backdrop-blur-xs">
                  <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
              )}

              <Tabs.Content value="general" className="px-6 pt-2 pb-6">
                <GeneralTab
                  project={project}
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  preferredEditorId={preferredEditorId}
                  setPreferredEditorId={setPreferredEditorId}
                  selectedGroupId={selectedGroupId}
                  setSelectedGroupId={setSelectedGroupId}
                />
              </Tabs.Content>

              <Tabs.Content value="notes" className="px-6 pt-2 pb-6">
                <NotesTab notes={notes} setNotes={setNotes} />
              </Tabs.Content>

              <Tabs.Content value="links" className="px-6 pt-2 pb-6">
                <ProjectLinksSection project={project} />
              </Tabs.Content>

              <Tabs.Content value="statistics" className="px-6 pt-2 pb-6">
                <StatisticsTab
                  statistics={statisticsData.statistics}
                  loading={statisticsData.loadingStatistics}
                />
              </Tabs.Content>

              <Tabs.Content value="commands" className="px-6 pt-2 pb-6">
                <CommandsTab
                  commands={commandsData.commands}
                  loading={commandsData.loadingCommands}
                  newCommand={commandsData.newCommand}
                  setNewCommand={commandsData.setNewCommand}
                  editingCommand={commandsData.editingCommand}
                  setEditingCommand={commandsData.setEditingCommand}
                  executingCommand={commandsData.executingCommand}
                  commandOutputs={commandsData.commandOutputs}
                  showCommandLog={commandsData.showCommandLog}
                  onAddCommand={commandsData.handleAddCommand}
                  onEditCommand={commandsData.handleEditCommand}
                  onDeleteCommand={commandsData.handleDeleteCommand}
                  onExecuteCommand={(cmdId) =>
                    commandsData.handleExecuteCommand(
                      cmdId,
                      project.project.path
                    )
                  }
                  onToggleCommandLog={commandsData.toggleCommandLog}
                />
              </Tabs.Content>

              <Tabs.Content value="git" className="px-6 pt-2 pb-6">
                <GitTab
                  gitConfig={gitData.gitConfig}
                  gitBranches={gitData.gitBranches}
                  defaultBranch={defaultBranch}
                  setDefaultBranch={setDefaultBranch}
                  gitGcLoading={gitData.gitGcLoading}
                  gitFetchLoading={gitData.gitFetchLoading}
                  onGitGc={gitData.handleGitGc}
                  onGitFetch={gitData.handleGitFetch}
                />
              </Tabs.Content>

              <Tabs.Content value="editor" className="px-6 pt-2 pb-6">
                <EditorTab
                  projectPath={project.project.path}
                  selectedEditor={selectedEditor}
                  editorSupportsWorkspaces={editorSupportsWorkspaces}
                  useWorkspace={useWorkspace}
                  setUseWorkspace={setUseWorkspace}
                  workspaceFile={workspaceFile}
                  setWorkspaceFile={setWorkspaceFile}
                  workspaceFiles={workspaceData.workspaceFiles}
                  loadingWorkspaceFiles={workspaceData.loadingWorkspaceFiles}
                />
              </Tabs.Content>

              <Tabs.Content value="tags" className="px-6 pt-2 pb-6">
                <TagsTab projectId={project.project.id} tags={project.tags} />
              </Tabs.Content>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-black/5 dark:border-white/5 shrink-0">
              <Button variant="glass" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                loading={saving}
                variant="glass-scope"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
