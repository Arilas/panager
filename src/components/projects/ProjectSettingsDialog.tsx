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
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { useProjectsStore } from "../../stores/projects";
import { useEditorsStore } from "../../stores/editors";
import { useSettingsStore } from "../../stores/settings";
import type { ProjectWithStatus, Editor, ProjectCommand, ProjectStatistics, ProjectLink } from "../../types";
import * as api from "../../lib/tauri";
import { ProjectLinksSection } from "./ProjectLinksSection";
import { formatRelativeTime } from "../../lib/utils";
import {
  Settings2,
  GitBranch,
  Code,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  X,
  Plus,
  Loader2,
  FileText,
  Link as LinkIcon,
  BarChart3,
  Terminal,
} from "lucide-react";

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
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotesPreview, setShowNotesPreview] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [projectGroups, setProjectGroups] = useState<Array<{ id: string; name: string; color: string | null }>>([]);

  // Git tab state
  const [gitBranches, setGitBranches] = useState<
    Array<{ name: string; isRemote: boolean; isCurrent: boolean }>
  >([]);
  const [gitConfig, setGitConfig] = useState<{
    userName: string | null;
    userEmail: string | null;
    remotes: Array<{ name: string; url: string }>;
  } | null>(null);
  const [gitGcLoading, setGitGcLoading] = useState(false);
  const [gitFetchLoading, setGitFetchLoading] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");

  // Editor tab state
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [loadingWorkspaceFiles, setLoadingWorkspaceFiles] = useState(false);

  // Links tab state
  const [projectLinks, setProjectLinks] = useState<ProjectLink[]>([]);

  // Statistics tab state
  const [statistics, setStatistics] = useState<ProjectStatistics | null>(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  // Commands tab state
  const [commands, setCommands] = useState<ProjectCommand[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [newCommand, setNewCommand] = useState({
    name: "",
    command: "",
    description: "",
    workingDirectory: "",
  });
  const [editingCommand, setEditingCommand] = useState<ProjectCommand | null>(null);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);
  const [commandOutputs, setCommandOutputs] = useState<Record<string, string>>({});
  const [showCommandLog, setShowCommandLog] = useState<Record<string, boolean>>({});

  const {
    updateProject,
    addTag,
    removeTag,
    getAllTags,
    updateProjectNotes,
    updateProjectDescription,
    getProjectCommands,
    createProjectCommand,
    updateProjectCommand,
    deleteProjectCommand,
    executeProjectCommand,
    fetchProjectStatistics,
    getProjectGroups,
    assignProjectToGroup,
  } = useProjectsStore();
  const { editors } = useEditorsStore();
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  const allTags = getAllTags();
  const suggestedTags = allTags.filter(
    (t) => !project?.tags.includes(t) && t.toLowerCase().includes(newTag.toLowerCase())
  );

  const selectedEditor = editors.find((e) => e.id === preferredEditorId);
  const editorSupportsWorkspaces = selectedEditor?.supportsWorkspaces ?? false;

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
      setBranchSearch("");
      // Reset statistics so they reload when tab is opened
      setStatistics(null);
      // Load project groups
      if (project.project.scopeId) {
        loadProjectGroups(project.project.scopeId);
      }
    }
  }, [open, project]);

  const loadProjectGroups = async (scopeId: string) => {
    try {
      const groups = await getProjectGroups(scopeId);
      setProjectGroups(groups);
    } catch (error) {
      console.error("Failed to load project groups:", error);
      setProjectGroups([]);
    }
  };

  // Load git data when Git tab is opened
  useEffect(() => {
    if (activeTab === "git" && project && open) {
      loadGitData();
    }
  }, [activeTab, project, open]);

  // Load workspace files when Editor tab is opened
  useEffect(() => {
    if (activeTab === "editor" && project && open && editorSupportsWorkspaces) {
      loadWorkspaceFiles();
    }
  }, [activeTab, project, open, editorSupportsWorkspaces]);

  // Load links when Links tab is opened
  useEffect(() => {
    if (activeTab === "links" && project && open) {
      loadProjectLinks();
    }
  }, [activeTab, project, open]);

  // Load statistics when Statistics tab is opened
  useEffect(() => {
    if (activeTab === "statistics" && project && open) {
      loadStatistics();
    }
  }, [activeTab, project, open]);

  // Load commands when Commands tab is opened
  useEffect(() => {
    if (activeTab === "commands" && project && open) {
      loadCommands();
    }
  }, [activeTab, project, open]);

  const loadGitData = async () => {
    if (!project) return;

    try {
      const [branches, config] = await Promise.all([
        api.getGitBranches(project.project.path).catch(() => []),
        api.getGitConfig(project.project.path).catch(() => null),
      ]);
      setGitBranches(branches);
      setGitConfig(config);
    } catch (error) {
      console.error("Failed to load git data:", error);
    }
  };

  const loadWorkspaceFiles = async () => {
    if (!project) return;

    setLoadingWorkspaceFiles(true);
    try {
      const files = await api.findWorkspaceFiles(project.project.path);
      setWorkspaceFiles(files);
    } catch (error) {
      console.error("Failed to load workspace files:", error);
      setWorkspaceFiles([]);
    } finally {
      setLoadingWorkspaceFiles(false);
    }
  };

  const loadProjectLinks = async () => {
    if (!project) return;
    try {
      // Use links from project prop if available
      if (project.links && project.links.length > 0) {
        setProjectLinks(project.links);
      } else {
        // Otherwise fetch them
        const links = await api.getProjectLinks(project.project.id);
        setProjectLinks(links);
      }
    } catch (error) {
      console.error("Failed to load project links:", error);
      setProjectLinks([]);
    }
  };

  const loadStatistics = async () => {
    if (!project) return;

    setLoadingStatistics(true);
    try {
      const stats = await fetchProjectStatistics(
        project.project.id,
        project.project.path
      );
      setStatistics(stats);
    } catch (error) {
      console.error("Failed to load statistics:", error);
      setStatistics(null);
    } finally {
      setLoadingStatistics(false);
    }
  };

  const loadCommands = async () => {
    if (!project) return;

    setLoadingCommands(true);
    try {
      const cmds = await getProjectCommands(project.project.id);
      setCommands(cmds);
    } catch (error) {
      console.error("Failed to load commands:", error);
      setCommands([]);
    } finally {
      setLoadingCommands(false);
    }
  };

  const handleAddCommand = async () => {
    if (!project || !newCommand.name.trim() || !newCommand.command.trim()) return;

    try {
      await createProjectCommand({
        projectId: project.project.id,
        name: newCommand.name.trim(),
        command: newCommand.command.trim(),
        description: newCommand.description.trim() || undefined,
        workingDirectory: newCommand.workingDirectory.trim() || undefined,
      });
      setNewCommand({ name: "", command: "", description: "", workingDirectory: "" });
      await loadCommands();
    } catch (error) {
      console.error("Failed to add command:", error);
    }
  };

  const handleEditCommand = async () => {
    if (!project || !editingCommand) return;

    try {
      await updateProjectCommand(
        editingCommand.id,
        editingCommand.name,
        editingCommand.command,
        editingCommand.description || undefined,
        editingCommand.workingDirectory || undefined
      );
      setEditingCommand(null);
      await loadCommands();
    } catch (error) {
      console.error("Failed to update command:", error);
    }
  };

  const handleDeleteCommand = async (commandId: string) => {
    try {
      await deleteProjectCommand(commandId);
      await loadCommands();
    } catch (error) {
      console.error("Failed to delete command:", error);
    }
  };

  const handleExecuteCommand = async (commandId: string) => {
    if (!project) return;

    setExecutingCommand(commandId);
    setCommandOutputs((prev) => ({ ...prev, [commandId]: "" }));
    setShowCommandLog((prev) => ({ ...prev, [commandId]: true }));
    try {
      const output = await executeProjectCommand(commandId, project.project.path);
      setCommandOutputs((prev) => ({ ...prev, [commandId]: output }));
    } catch (error) {
      setCommandOutputs((prev) => ({ ...prev, [commandId]: String(error) }));
    } finally {
      setExecutingCommand(null);
    }
  };

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

  const handleCopyPath = () => {
    if (project) {
      navigator.clipboard.writeText(project.project.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddTag = async (tag: string) => {
    if (!project || !tag.trim()) return;

    try {
      await addTag(project.project.id, tag.trim().toLowerCase());
      setNewTag("");
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!project) return;

    try {
      await removeTag(project.project.id, tag);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const handleGitGc = async () => {
    if (!project) return;

    setGitGcLoading(true);
    try {
      await api.gitGc(project.project.path);
      // Optionally show success message
    } catch (error) {
      console.error("Git GC failed:", error);
    } finally {
      setGitGcLoading(false);
    }
  };

  const handleGitFetch = async () => {
    if (!project) return;

    setGitFetchLoading(true);
    try {
      await api.gitFetch(project.project.path);
      // Refresh git status after fetch
      await loadGitData();
    } catch (error) {
      console.error("Git fetch failed:", error);
    } finally {
      setGitFetchLoading(false);
    }
  };

  const filteredBranches = gitBranches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        {!useLiquidGlass && (
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
        )}
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-[460px]">
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              useLiquidGlass
                ? "p-3 liquid-glass-sidebar gap-1 pt-10"
                : "p-2 pt-6 border-r border-black/5 dark:border-white/5"
            )}
          >
            <TabTrigger value="general" icon={<Settings2 className="h-4 w-4" />}>
              General
            </TabTrigger>
            <TabTrigger value="notes" icon={<FileText className="h-4 w-4" />}>
              Notes
            </TabTrigger>
            <TabTrigger value="links" icon={<LinkIcon className="h-4 w-4" />}>
              Links
            </TabTrigger>
            <TabTrigger value="statistics" icon={<BarChart3 className="h-4 w-4" />}>
              Statistics
            </TabTrigger>
            <TabTrigger value="commands" icon={<Terminal className="h-4 w-4" />}>
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
                <DialogHeader className="px-6 pt-4 pb-2 shrink-0 sticky top-0 z-50 backdrop-blur-sm">
                  <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
              )}

              <Tabs.Content value="general" className="px-6 pt-2 pb-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Project Name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Project name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Project Path
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={project.project.path}
                        readOnly
                        className="flex-1 font-mono text-[12px]"
                      />
                      <button
                        onClick={handleCopyPath}
                        className={cn(
                          "px-3 py-2 rounded-md transition-colors",
                          "bg-black/5 dark:bg-white/10",
                          "hover:bg-black/10 dark:hover:bg-white/15"
                        )}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Description
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short description or reminder..."
                      maxLength={100}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      A brief description shown in the project list
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Default Editor
                    </label>
                    <select
                      value={preferredEditorId}
                      onChange={(e) => setPreferredEditorId(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-md text-[13px]",
                        "bg-white dark:bg-white/5",
                        "border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                    >
                      <option value="">Use scope default</option>
                      {editors
                        .filter((e) => e.isAvailable)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Project Group
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-md text-[13px]",
                        "bg-white dark:bg-white/5",
                        "border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                    >
                      <option value="">Ungrouped</option>
                      {projectGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Organize this project into a group
                    </p>
                  </div>
                </div>
              </Tabs.Content>

              <Tabs.Content value="notes" className="px-6 pt-2 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Project Notes
                    </label>
                    <button
                      onClick={() => setShowNotesPreview(!showNotesPreview)}
                      className={cn(
                        "text-[11px] px-2 py-1 rounded",
                        "bg-black/5 dark:bg-white/10",
                        "hover:bg-black/10 dark:hover:bg-white/15",
                        "transition-colors"
                      )}
                    >
                      {showNotesPreview ? "Edit" : "Preview"}
                    </button>
                  </div>
                  {showNotesPreview ? (
                    <div
                      className={cn(
                        "min-h-[300px] p-3 rounded-md",
                        "bg-black/5 dark:bg-white/5",
                        "text-[13px] whitespace-pre-wrap"
                      )}
                    >
                      {notes || (
                        <span className="text-muted-foreground italic">
                          No notes yet
                        </span>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add markdown notes, reminders, links to docs, issues, etc..."
                      className={cn(
                        "w-full min-h-[300px] px-3 py-2 rounded-md text-[13px]",
                        "bg-white dark:bg-white/5",
                        "border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50",
                        "font-mono resize-none"
                      )}
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Markdown supported. Notes are shown in the project list (truncated).
                  </p>
                </div>
              </Tabs.Content>

              <Tabs.Content value="links" className="px-6 pt-2 pb-6">
                {project && <ProjectLinksSection project={project} />}
              </Tabs.Content>

              <Tabs.Content value="statistics" className="px-6 pt-2 pb-6">
                <div className="space-y-6">
                  {loadingStatistics ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : statistics ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {statistics.fileCount !== null && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground/70">
                              File Count
                            </label>
                            <p className="text-[13px]">{statistics.fileCount.toLocaleString()}</p>
                          </div>
                        )}
                        {statistics.repoSizeBytes !== null && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground/70">
                              Repository Size
                            </label>
                            <p className="text-[13px]">
                              {(statistics.repoSizeBytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        )}
                        {statistics.commitCount !== null && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground/70">
                              Commits
                            </label>
                            <p className="text-[13px]">
                              {statistics.commitCount.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {statistics.lastCommit && (
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-foreground/70">
                            Last Commit
                          </label>
                          <div className="p-3 rounded-md bg-black/5 dark:bg-white/5">
                            <p className="text-[12px] font-mono text-muted-foreground mb-1">
                              {statistics.lastCommit.hash.slice(0, 8)}
                            </p>
                            <p className="text-[13px] mb-1">{statistics.lastCommit.message}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {statistics.lastCommit.author} •{" "}
                              {formatRelativeTime(statistics.lastCommit.date)}
                            </p>
                          </div>
                        </div>
                      )}

                      {statistics.languages.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-foreground/70">
                            Languages
                          </label>
                          <div className="space-y-1">
                            {statistics.languages.map((lang) => (
                              <div
                                key={lang.name}
                                className="flex items-center justify-between text-[12px]"
                              >
                                <span>{lang.name}</span>
                                <span className="text-muted-foreground">
                                  {lang.percentage.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {statistics.contributors.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-foreground/70">
                            Contributors
                          </label>
                          <div className="space-y-1">
                            {statistics.contributors.map((contrib, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[12px]"
                              >
                                <span>{contrib.name}</span>
                                <span className="text-muted-foreground">
                                  {contrib.commitCount} commits
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-muted-foreground py-4">
                      Statistics not available
                    </p>
                  )}
                </div>
              </Tabs.Content>

              <Tabs.Content value="commands" className="px-6 pt-2 pb-6">
                <div className="space-y-4">
                  {loadingCommands ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {commands.length === 0 ? (
                          <p className="text-[13px] text-muted-foreground py-2">
                            No commands yet
                          </p>
                        ) : (
                          commands.map((cmd) => (
                            <div
                              key={cmd.id}
                              className="p-3 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="text-[13px] font-medium">{cmd.name}</h4>
                                  {cmd.description && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {cmd.description}
                                    </p>
                                  )}
                                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                                    {cmd.command}
                                  </p>
                                  {cmd.workingDirectory && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Working dir: {cmd.workingDirectory}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleExecuteCommand(cmd.id)}
                                    disabled={executingCommand === cmd.id}
                                    className={cn(
                                      "px-2 py-1 rounded text-[11px]",
                                      "bg-primary/10 text-primary hover:bg-primary/20",
                                      "disabled:opacity-50"
                                    )}
                                  >
                                    {executingCommand === cmd.id ? "Running..." : "Run"}
                                  </button>
                                  <button
                                    onClick={() => setEditingCommand(cmd)}
                                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCommand(cmd.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-red-500"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {commandOutputs[cmd.id] && (
                                <div className="mt-2 space-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowCommandLog((prev) => ({
                                        ...prev,
                                        [cmd.id]: !prev[cmd.id],
                                      }))
                                    }
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Terminal className="h-3 w-3" />
                                    {showCommandLog[cmd.id] ? "Hide" : "Show"} output
                                  </button>
                                  {showCommandLog[cmd.id] && commandOutputs[cmd.id] && (
                                    <div
                                      className={cn(
                                        "rounded-md bg-black/5 dark:bg-black/30 p-2",
                                        "font-mono text-[10px] leading-relaxed",
                                        "max-h-[200px] overflow-y-auto",
                                        "text-muted-foreground whitespace-pre-wrap break-all"
                                      )}
                                    >
                                      {commandOutputs[cmd.id]}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {editingCommand ? (
                        <div className="p-3 rounded-lg border border-black/10 dark:border-white/10 space-y-3">
                          <h4 className="text-[12px] font-medium">Edit Command</h4>
                          <Input
                            value={editingCommand.name}
                            onChange={(e) =>
                              setEditingCommand({
                                ...editingCommand,
                                name: e.target.value,
                              })
                            }
                            placeholder="Command name"
                          />
                          <Input
                            value={editingCommand.command}
                            onChange={(e) =>
                              setEditingCommand({
                                ...editingCommand,
                                command: e.target.value,
                              })
                            }
                            placeholder="Command to run"
                          />
                          <Input
                            value={editingCommand.description || ""}
                            onChange={(e) =>
                              setEditingCommand({
                                ...editingCommand,
                                description: e.target.value,
                              })
                            }
                            placeholder="Description (optional)"
                          />
                          <Input
                            value={editingCommand.workingDirectory || ""}
                            onChange={(e) =>
                              setEditingCommand({
                                ...editingCommand,
                                workingDirectory: e.target.value,
                              })
                            }
                            placeholder="Working directory (optional, relative to project)"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="glass"
                              size="sm"
                              onClick={() => setEditingCommand(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="glass-scope"
                              size="sm"
                              onClick={handleEditCommand}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed border-black/10 dark:border-white/10 space-y-3">
                          <h4 className="text-[12px] font-medium">Add Command</h4>
                          <Input
                            value={newCommand.name}
                            onChange={(e) =>
                              setNewCommand({ ...newCommand, name: e.target.value })
                            }
                            placeholder="Command name"
                          />
                          <Input
                            value={newCommand.command}
                            onChange={(e) =>
                              setNewCommand({ ...newCommand, command: e.target.value })
                            }
                            placeholder="Command to run (e.g., npm run build)"
                          />
                          <Input
                            value={newCommand.description}
                            onChange={(e) =>
                              setNewCommand({ ...newCommand, description: e.target.value })
                            }
                            placeholder="Description (optional)"
                          />
                          <Input
                            value={newCommand.workingDirectory}
                            onChange={(e) =>
                              setNewCommand({
                                ...newCommand,
                                workingDirectory: e.target.value,
                              })
                            }
                            placeholder="Working directory (optional, relative to project)"
                          />
                          <Button
                            variant="glass-scope"
                            size="sm"
                            onClick={handleAddCommand}
                            disabled={!newCommand.name.trim() || !newCommand.command.trim()}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Add Command
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Tabs.Content>

              <Tabs.Content value="git" className="px-6 pt-2 pb-6">
                <div className="space-y-6">
                  {gitConfig && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[12px] font-medium text-foreground/70">
                          Git User Name
                        </label>
                        <Input
                          value={gitConfig.userName || ""}
                          readOnly
                          className="bg-black/5 dark:bg-white/5"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] font-medium text-foreground/70">
                          Git User Email
                        </label>
                        <Input
                          value={gitConfig.userEmail || ""}
                          readOnly
                          className="bg-black/5 dark:bg-white/5"
                        />
                      </div>

                      {gitConfig.remotes.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-foreground/70">
                            Remote Origins
                          </label>
                          <div className="space-y-1">
                            {gitConfig.remotes.map((remote) => (
                              <div
                                key={remote.name}
                                className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/5 text-[12px] font-mono"
                              >
                                <span className="font-medium">{remote.name}:</span>{" "}
                                {remote.url}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Default Branch
                    </label>
                    <Input
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="Search branches..."
                      className="mb-2"
                    />
                    <select
                      value={defaultBranch}
                      onChange={(e) => setDefaultBranch(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-md text-[13px]",
                        "bg-white dark:bg-white/5",
                        "border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                      size={Math.min(filteredBranches.length + 1, 8)}
                    >
                      <option value="">No default branch</option>
                      {filteredBranches.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.isCurrent && "✓ "}
                          {branch.name}
                          {branch.isRemote && " (remote)"}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      This is for reference only. The branch will not be switched automatically.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="glass"
                      onClick={handleGitGc}
                      disabled={gitGcLoading}
                      className="flex-1"
                    >
                      {gitGcLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Run Git GC
                        </>
                      )}
                    </Button>
                    <Button
                      variant="glass"
                      onClick={handleGitFetch}
                      disabled={gitFetchLoading}
                      className="flex-1"
                    >
                      {gitFetchLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" />
                          Fetch from Remote
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Tabs.Content>

              <Tabs.Content value="editor" className="px-6 pt-2 pb-6">
                <div className="space-y-6">
                  {editorSupportsWorkspaces ? (
                    <>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[12px] font-medium text-foreground/70">
                          <input
                            type="checkbox"
                            checked={useWorkspace}
                            onChange={(e) => {
                              setUseWorkspace(e.target.checked);
                              if (!e.target.checked) {
                                setWorkspaceFile("");
                              }
                            }}
                            className="rounded"
                          />
                          Open with selected workspace
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          When enabled, the project will open using the selected workspace file
                          instead of the project folder.
                        </p>
                      </div>

                      {useWorkspace && (
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-foreground/70">
                            Workspace File
                          </label>
                          {loadingWorkspaceFiles ? (
                            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Scanning for workspace files...
                            </div>
                          ) : workspaceFiles.length > 0 ? (
                            <select
                              value={workspaceFile}
                              onChange={(e) => setWorkspaceFile(e.target.value)}
                              className={cn(
                                "w-full px-3 py-2 rounded-md text-[13px]",
                                "bg-white dark:bg-white/5",
                                "border border-black/10 dark:border-white/10",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50"
                              )}
                            >
                              <option value="">Select workspace file...</option>
                              {workspaceFiles.map((file) => {
                                const relativePath = file.replace(
                                  project.project.path + "/",
                                  ""
                                );
                                return (
                                  <option key={file} value={file}>
                                    {relativePath}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              No .code-workspace files found in this project.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      {selectedEditor
                        ? `${selectedEditor.name} does not support workspace files.`
                        : "Select an editor that supports workspaces (e.g., VS Code, Cursor) to use this feature."}
                    </p>
                  )}
                </div>
              </Tabs.Content>

              <Tabs.Content value="tags" className="px-6 pt-2 pb-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground/70">
                      Current Tags
                    </label>
                    {project.tags.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground py-2">
                        No tags yet
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px]",
                              "bg-primary/10 text-primary"
                            )}
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-0.5 hover:bg-primary/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTag(newTag);
                    }}
                    className="space-y-2"
                  >
                    <label className="text-[12px] font-medium text-foreground/70">
                      Add Tag
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Enter tag name..."
                        className="flex-1"
                      />
                      <button
                        type="submit"
                        disabled={!newTag.trim()}
                        className={cn(
                          "px-3 py-2 rounded-md",
                          "bg-primary text-primary-foreground",
                          "hover:bg-primary/90 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </form>

                  {suggestedTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-foreground/70">
                        Suggestions
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedTags.slice(0, 8).map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleAddTag(tag)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px]",
                              "bg-black/5 dark:bg-white/10",
                              "hover:bg-black/10 dark:hover:bg-white/15",
                              "transition-colors"
                            )}
                          >
                            <Plus className="h-3 w-3" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

function TabTrigger({
  value,
  children,
  icon,
}: {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  if (useLiquidGlass) {
    return (
      <Tabs.Trigger
        value={value}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md text-left font-medium",
          "text-foreground/70 transition-colors",
          "hover:bg-black/5 dark:hover:bg-white/5",
          "data-[state=active]:bg-[color-mix(in_srgb,_var(--scope-color)_10%,_transparent)] data-[state=active]:text-[var(--scope-color)]"
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </Tabs.Trigger>
    );
  }
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-[13px] rounded-md text-left",
        "text-foreground/70 transition-colors",
        "hover:bg-black/5 dark:hover:bg-white/5",
        "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
        "data-[state=active]:font-medium"
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </Tabs.Trigger>
  );
}
