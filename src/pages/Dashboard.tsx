import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  FolderPlus,
  RefreshCw,
  Zap,
  ArrowUpDown,
  Tag,
  X,
} from "lucide-react";
import { useScopesStore } from "../stores/scopes";
import { useProjectsStore } from "../stores/projects";
import { useEditorsStore } from "../stores/editors";
import { useUIStore } from "../stores/ui";
import { ProjectListItem } from "../components/projects/ProjectListItem";
import { ScopeInfoPanel } from "../components/scopes/ScopeInfoPanel";
import { ScopeSelector } from "../components/scopes/ScopeSelector";
import { TempProjectDialog } from "../components/temp-projects/TempProjectDialog";
import { ProjectTagsDialog } from "../components/projects/ProjectTagsDialog";
import { EditScopeDialog } from "../components/scopes/EditScopeDialog";
import { DeleteScopeDialog } from "../components/scopes/DeleteScopeDialog";
import { ScopeLinksDialog } from "../components/scopes/ScopeLinksDialog";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../lib/utils";
import type { ProjectWithStatus } from "../types";

interface DashboardProps {
  onNewScopeClick: () => void;
}

export function Dashboard({ onNewScopeClick }: DashboardProps) {
  const { scopes, currentScopeId, getCurrentScope, fetchScopes } =
    useScopesStore();
  const {
    projects,
    loading,
    fetchProjects,
    createProject,
    deleteProject,
    refreshGitStatus,
    gitPull,
    gitPush,
    openInEditor,
    updateLastOpened,
    scanFolder,
    moveProjectToScope,
  } = useProjectsStore();
  const { editors, syncEditors, getDefaultEditor } = useEditorsStore();
  const { rightPanelVisible, searchQuery } = useUIStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showTempProject, setShowTempProject] = useState(false);
  const [tagsProject, setTagsProject] = useState<ProjectWithStatus | null>(
    null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "lastOpened" | "dateAdded">(
    "lastOpened"
  );
  const [showEditScope, setShowEditScope] = useState(false);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const [showScopeLinks, setShowScopeLinks] = useState(false);

  const currentScope = getCurrentScope();

  // Get all unique tags from projects
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Filter by search query (matches name or path)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.project.name.toLowerCase().includes(query) ||
          p.project.path.toLowerCase().includes(query)
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      result = result.filter((p) =>
        selectedTags.every((tag) => p.tags.includes(tag))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.project.name.localeCompare(b.project.name);
        case "lastOpened":
          const aDate = a.project.lastOpenedAt || a.project.createdAt;
          const bDate = b.project.lastOpenedAt || b.project.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        case "dateAdded":
          return (
            new Date(b.project.createdAt).getTime() -
            new Date(a.project.createdAt).getTime()
          );
        default:
          return 0;
      }
    });

    return result;
  }, [projects, selectedTags, sortBy, searchQuery]);

  useEffect(() => {
    fetchScopes();
    syncEditors();
  }, [fetchScopes, syncEditors]);

  useEffect(() => {
    if (currentScopeId) {
      console.log("Fetching projects for scope:", currentScopeId);
      fetchProjects(currentScopeId).then(() => {
        console.log("Projects fetched:", projects.length);
      });
    }
  }, [currentScopeId, fetchProjects]);

  // Refresh git status for all projects periodically
  useEffect(() => {
    if (!projects.length) return;

    const refreshAll = async () => {
      for (const p of projects) {
        await refreshGitStatus(p.project.id, p.project.path);
      }
    };

    refreshAll();

    const interval = setInterval(refreshAll, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(interval);
  }, [projects.length, refreshGitStatus]);

  const handleAddProject = async () => {
    if (!currentScopeId) return;

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Folder",
    });

    if (selected && typeof selected === "string") {
      const name = selected.split("/").pop() || "Untitled";
      try {
        await createProject({
          scopeId: currentScopeId,
          name,
          path: selected,
        });
        // Force refresh to ensure we have latest data
        await fetchProjects(currentScopeId);
      } catch (e) {
        console.error("Failed to add project:", e);
      }
    }
  };

  const handleScanFolder = async () => {
    if (!currentScopeId) return;

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Folder to Scan",
    });

    if (selected && typeof selected === "string") {
      try {
        const repos = await scanFolder(selected);
        console.log("Found repos:", repos);

        let addedCount = 0;
        for (const repoPath of repos) {
          const name = repoPath.split("/").pop() || "Untitled";
          try {
            await createProject({
              scopeId: currentScopeId,
              name,
              path: repoPath,
            });
            addedCount++;
          } catch (e) {
            // Project might already exist (unique path constraint)
            console.log("Skipping (may already exist):", repoPath, e);
          }
        }

        // Force refresh to ensure we have latest data
        await fetchProjects(currentScopeId);
        console.log(
          `Added ${addedCount} projects, found ${repos.length} repos`
        );
      } catch (e) {
        console.error("Scan folder error:", e);
      }
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    for (const p of projects) {
      await refreshGitStatus(p.project.id, p.project.path);
    }
    setRefreshing(false);
  };

  const handleOpenProject = async (
    projectId: string,
    projectPath: string,
    editorId?: string | null
  ) => {
    const editor = editorId
      ? editors.find((e) => e.id === editorId)
      : getDefaultEditor();

    if (editor) {
      await openInEditor(editor.command, projectPath);
      await updateLastOpened(projectId);
    }
  };

  const handlePull = async (projectPath: string, projectId: string) => {
    try {
      await gitPull(projectPath);
      await refreshGitStatus(projectId, projectPath);
    } catch (e) {
      console.error("Pull failed:", e);
    }
  };

  const handlePush = async (projectPath: string, projectId: string) => {
    try {
      await gitPush(projectPath);
      await refreshGitStatus(projectId, projectPath);
    } catch (e) {
      console.error("Push failed:", e);
    }
  };

  const handleOpenWithEditor = async (
    projectId: string,
    projectPath: string,
    editorId: string
  ) => {
    const editor = editors.find((e) => e.id === editorId);
    if (editor) {
      await openInEditor(editor.command, projectPath);
      await updateLastOpened(projectId);
    }
  };

  const handleRevealInFinder = async (projectPath: string) => {
    try {
      await invoke("plugin:shell|open", { path: projectPath });
    } catch (e) {
      console.error("Failed to reveal in finder:", e);
    }
  };

  const handleCopyPath = (projectPath: string) => {
    navigator.clipboard.writeText(projectPath);
  };

  const handleMoveToScope = async (projectId: string, scopeId: string) => {
    try {
      await moveProjectToScope(projectId, scopeId);
    } catch (e) {
      console.error("Failed to move project:", e);
    }
  };

  if (!currentScopeId || !currentScope) {
    return (
      <div className="flex-1 flex bg-vibrancy-sidebar overflow-hidden p-2 pt-0">
        <div
          className={cn(
            "flex-1 flex items-center justify-center",
            "bg-white/80 dark:bg-neutral-900/80",
            "rounded-xl",
            "border border-black/[0.08] dark:border-white/[0.08]"
          )}
        >
          <div className="text-center">
            <h2 className="text-[15px] font-medium text-foreground/80 mb-3">
              {scopes.length === 0
                ? "Create your first scope"
                : "Select a scope"}
            </h2>
            <ScopeSelector onNewScopeClick={onNewScopeClick} />
          </div>
        </div>
      </div>
    );
  }

  // Get scope's default editor
  const scopeDefaultEditor = currentScope?.scope.defaultEditorId
    ? editors.find((e) => e.id === currentScope.scope.defaultEditorId)
    : getDefaultEditor();

  return (
    <div className="flex-1 flex bg-vibrancy-sidebar overflow-hidden p-2 pt-0 gap-2">
      {/* Main Content Island */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          "bg-white/80 dark:bg-neutral-900/80",
          "rounded-xl",
          "border border-black/[0.08] dark:border-white/[0.08]",
          "overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <ScopeSelector onNewScopeClick={onNewScopeClick} />
            <span className="text-[12px] text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pr-1">
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium",
                "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
                "text-foreground/70 transition-colors flex items-center gap-1.5",
                refreshing && "opacity-50"
              )}
            >
              <RefreshCw
                className={cn("h-3 w-3", refreshing && "animate-spin")}
              />
              Refresh
            </button>
            <button
              onClick={handleScanFolder}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium",
                "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
                "text-foreground/70 transition-colors flex items-center gap-1.5"
              )}
            >
              <FolderPlus className="h-3 w-3" />
              Scan
            </button>
            <button
              onClick={() => setShowTempProject(true)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium",
                "bg-amber-500 text-white hover:bg-amber-600",
                "transition-colors flex items-center gap-1.5"
              )}
            >
              <Zap className="h-3 w-3" />
              Temp
            </button>
            <button
              onClick={handleAddProject}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium",
                "scope-accent scope-accent-text",
                "transition-colors flex items-center gap-1.5"
              )}
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {(allTags.length > 0 || projects.length > 0) && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Sort */}
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <ArrowUpDown className="h-3 w-3" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className={cn(
                    "bg-transparent text-[12px] focus:outline-none cursor-pointer",
                    "hover:text-foreground transition-colors"
                  )}
                >
                  <option value="lastOpened">Last Opened</option>
                  <option value="name">Name</option>
                  <option value="dateAdded">Date Added</option>
                </select>
              </div>

              {/* Tag Filters */}
              {allTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags(
                          selectedTags.includes(tag)
                            ? selectedTags.filter((t) => t !== tag)
                            : [...selectedTags, tag]
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]",
                        "transition-colors",
                        selectedTags.includes(tag)
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/[0.04] dark:bg-white/[0.08] text-foreground/60 hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
                      )}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </button>
                  ))}
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-12 w-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3">
                <FolderPlus className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <h3 className="text-[14px] font-medium text-foreground/80 mb-1">
                No Projects Yet
              </h3>
              <p className="text-[12px] text-muted-foreground mb-4 max-w-[280px]">
                Add a project manually or scan a folder to find Git
                repositories.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleScanFolder}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium",
                    "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
                    "text-foreground/70 transition-colors flex items-center gap-1.5"
                  )}
                >
                  <FolderPlus className="h-3 w-3" />
                  Scan Folder
                </button>
                <button
                  onClick={handleAddProject}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "transition-colors flex items-center gap-1.5"
                  )}
                >
                  <Plus className="h-3 w-3" />
                  Add Project
                </button>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-12 w-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3">
                <Tag className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <h3 className="text-[14px] font-medium text-foreground/80 mb-1">
                No Matching Projects
              </h3>
              <p className="text-[12px] text-muted-foreground mb-4 max-w-[280px]">
                No projects match the current search or filter.
              </p>
              <button
                onClick={() => setSelectedTags([])}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[12px] font-medium",
                  "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
                  "text-foreground/70 transition-colors"
                )}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => (
                <ProjectListItem
                  key={project.project.id}
                  project={project}
                  editor={
                    project.project.preferredEditorId
                      ? editors.find(
                          (e) => e.id === project.project.preferredEditorId
                        )
                      : scopeDefaultEditor
                  }
                  editors={editors}
                  scopes={scopes}
                  currentScopeId={currentScopeId}
                  onOpen={() =>
                    handleOpenProject(
                      project.project.id,
                      project.project.path,
                      project.project.preferredEditorId
                    )
                  }
                  onOpenWithEditor={(editorId) =>
                    handleOpenWithEditor(
                      project.project.id,
                      project.project.path,
                      editorId
                    )
                  }
                  onDelete={() => deleteProject(project.project.id)}
                  onRefreshGit={() =>
                    refreshGitStatus(project.project.id, project.project.path)
                  }
                  onPull={() =>
                    handlePull(project.project.path, project.project.id)
                  }
                  onPush={() =>
                    handlePush(project.project.path, project.project.id)
                  }
                  onRevealInFinder={() =>
                    handleRevealInFinder(project.project.path)
                  }
                  onCopyPath={() => handleCopyPath(project.project.path)}
                  onMoveToScope={(scopeId) =>
                    handleMoveToScope(project.project.id, scopeId)
                  }
                  onManageTags={() => setTagsProject(project)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Scope Info */}
      {rightPanelVisible && (
        <div className="w-[260px] shrink-0 hidden lg:block">
          <ScopeInfoPanel
            scope={currentScope}
            projectCount={projects.length}
            defaultEditor={scopeDefaultEditor}
            onEditScope={() => setShowEditScope(true)}
            onManageLinks={() => setShowScopeLinks(true)}
            onDeleteScope={() => setShowDeleteScope(true)}
          />
        </div>
      )}

      {/* Dialogs */}
      <TempProjectDialog
        open={showTempProject}
        onOpenChange={setShowTempProject}
      />
      <ProjectTagsDialog
        project={tagsProject}
        open={!!tagsProject}
        onOpenChange={(open) => !open && setTagsProject(null)}
      />
      <EditScopeDialog
        scope={currentScope}
        open={showEditScope}
        onOpenChange={setShowEditScope}
      />
      <DeleteScopeDialog
        scope={currentScope}
        open={showDeleteScope}
        onOpenChange={setShowDeleteScope}
      />
      <ScopeLinksDialog
        scope={currentScope}
        open={showScopeLinks}
        onOpenChange={setShowScopeLinks}
      />
    </div>
  );
}
