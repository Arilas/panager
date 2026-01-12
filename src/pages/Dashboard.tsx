import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Plus,
  FolderPlus,
  RefreshCw,
  Zap,
  ArrowUpDown,
  Tag,
  X,
  FolderInput,
  Download,
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
import { GitConfigDialog } from "../components/git/GitConfigDialog";
import { CloneRepositoryDialog } from "../components/scopes/CloneRepositoryDialog";
import { DeleteProjectDialog } from "../components/projects/DeleteProjectDialog";
import { MoveProjectDialog } from "../components/projects/MoveProjectDialog";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { useSettingsStore } from "../stores/settings";
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
  } = useProjectsStore();
  const { editors, syncEditors, getDefaultEditor } = useEditorsStore();
  const { rightPanelVisible, searchQuery } = useUIStore();
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;
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
  const [showGitConfig, setShowGitConfig] = useState(false);
  const [showCloneRepo, setShowCloneRepo] = useState(false);
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectWithStatus | null>(null);
  const [projectToMove, setProjectToMove] = useState<{
    project: ProjectWithStatus;
    targetScopeId: string;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const currentScope = getCurrentScope();
  const { gitConfigs } = useScopesStore();

  // Handle dropped folders to add as projects
  const handleDroppedPaths = useCallback(
    async (paths: string[]) => {
      if (!currentScopeId) return;

      for (const path of paths) {
        const name = path.split("/").pop() || "Untitled";
        try {
          await createProject({
            scopeId: currentScopeId,
            name,
            path,
            isTemp: null,
          });
        } catch (e) {
          console.log("Skipping (may already exist):", path, e);
        }
      }
      await fetchProjects(currentScopeId);
    },
    [currentScopeId, createProject, fetchProjects]
  );

  // Listen for drag-drop events from Tauri
  useEffect(() => {
    const webview = getCurrentWebview();
    const unlisten = webview.onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        handleDroppedPaths(event.payload.paths);
      } else {
        setIsDragOver(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleDroppedPaths]);

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

  // Reset selection when filtered projects change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery, selectedTags, sortBy, currentScopeId]);

  // Keyboard navigation for project list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (filteredProjects.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredProjects.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          if (selectedIndex >= 0 && selectedIndex < filteredProjects.length) {
            e.preventDefault();
            const project = filteredProjects[selectedIndex];
            handleOpenProject(
              project.project.id,
              project.project.path,
              project.project.preferredEditorId
            );
          }
          break;
        case "Escape":
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredProjects, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-project-item]");
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  const handleAddProject = async () => {
    if (!currentScopeId) return;

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Folder",
    });

    if (selected && typeof selected === "string") {
      try {
        // Scan the folder for git repos (handles both single repo and nested repos)
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
              isTemp: null,
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
        console.error("Failed to add project:", e);
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
      await revealItemInDir(projectPath);
    } catch (e) {
      console.error("Failed to reveal in finder:", e);
    }
  };

  const handleCopyPath = (projectPath: string) => {
    navigator.clipboard.writeText(projectPath);
  };

  const handleMoveToScope = (project: ProjectWithStatus, scopeId: string) => {
    setProjectToMove({ project, targetScopeId: scopeId });
  };

  const handleMoveSuccess = async () => {
    if (currentScopeId) {
      await fetchProjects(currentScopeId);
    }
  };

  if (!currentScopeId || !currentScope) {
    return (
      <div
        className={cn(
          "flex-1 flex overflow-hidden p-2 pt-0",
          !useLiquidGlass && "bg-vibrancy-sidebar"
        )}
      >
        <div
          className={cn(
            "flex-1 flex items-center justify-center rounded-xl",
            useLiquidGlass
              ? "liquid-glass-scope"
              : [
                  "bg-white/60 dark:bg-neutral-900/60",
                  "backdrop-blur-xl",
                  "border border-black/[0.08] dark:border-white/[0.08]",
                ]
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
    <div
      className={cn(
        "flex-1 flex overflow-hidden p-2 pt-0",
        !useLiquidGlass && "bg-vibrancy-sidebar"
      )}
    >
      {/* Main Content Island */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 relative overflow-hidden",
          // useLiquidGlass
          //   ? "liquid-glass-scope rounded-xl"
          //   : [
          "bg-white/70 dark:bg-neutral-900/70",
          "backdrop-blur-xl",
          "rounded-xl",
          "border border-black/[0.08] dark:border-white/[0.08]",
          // ],
          isDragOver && "border-primary border-2"
        )}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div
            className={cn(
              "absolute inset-0 z-50",
              "bg-primary/10 backdrop-blur-sm",
              "flex flex-col items-center justify-center gap-3",
              "pointer-events-none"
            )}
          >
            <div
              className={cn(
                "h-16 w-16 rounded-2xl",
                "bg-primary/20 border-2 border-dashed border-primary",
                "flex items-center justify-center"
              )}
            >
              <FolderInput className="h-8 w-8 text-primary" />
            </div>
            <p className="text-[14px] font-medium text-primary">
              Drop folder to add project
            </p>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <ScopeSelector onNewScopeClick={onNewScopeClick} />
            <span className="text-[12px] text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pr-1">
            <Button
              variant="glass"
              size="sm"
              onClick={handleRefreshAll}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              variant="glass-scope"
              size="sm"
              onClick={() => setShowTempProject(true)}
              disabled={!currentScope?.scope.defaultFolder}
              title={
                !currentScope?.scope.defaultFolder
                  ? "Set a default folder in scope settings to create temp projects"
                  : undefined
              }
            >
              <Zap className="h-3 w-3 mr-1.5" />
              Temp
            </Button>
            {currentScope?.scope.defaultFolder && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => setShowCloneRepo(true)}
              >
                <Download className="h-3 w-3 mr-1.5" />
                Clone
              </Button>
            )}
            {!currentScope?.scope.defaultFolder && (
              <Button variant="scope" size="sm" onClick={handleAddProject}>
                <Plus className="h-3 w-3 mr-1.5" />
                Add
              </Button>
            )}
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
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-4">
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
                {currentScope?.scope.defaultFolder
                  ? "Projects will be auto-discovered from your default folder."
                  : "Add a folder to find Git repositories."}
              </p>
              {!currentScope?.scope.defaultFolder && (
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
              )}
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
              {filteredProjects.map((project, index) => (
                <div key={project.project.id} data-project-item>
                  <ProjectListItem
                    project={project}
                    isSelected={index === selectedIndex}
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
                    currentScopeHasDefaultFolder={
                      !!currentScope?.scope.defaultFolder
                    }
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
                    onDeleteWithFolder={() => setProjectToDelete(project)}
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
                      handleMoveToScope(project, scopeId)
                    }
                    onManageTags={() => setTagsProject(project)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Scope Info */}
      <div
        className={cn(
          "shrink-0 hidden lg:block transition-all duration-200 ease-out overflow-hidden",
          rightPanelVisible ? "w-[260px] opacity-100 ml-2" : "w-0 opacity-0"
        )}
      >
        <ScopeInfoPanel
          scope={currentScope}
          projectCount={projects.length}
          defaultEditor={scopeDefaultEditor}
          onEditScope={() => setShowEditScope(true)}
          onManageLinks={() => setShowScopeLinks(true)}
          onSetupGitIdentity={() => setShowGitConfig(true)}
        />
      </div>

      {/* Dialogs */}
      {currentScope && currentScope.scope.defaultFolder && (
        <TempProjectDialog
          scope={currentScope}
          open={showTempProject}
          onOpenChange={setShowTempProject}
          onCreated={async () => {
            // Refresh projects after creation
            if (currentScopeId) {
              await fetchProjects(currentScopeId);
            }
          }}
        />
      )}
      <ProjectTagsDialog
        project={tagsProject}
        open={!!tagsProject}
        onOpenChange={(open) => !open && setTagsProject(null)}
      />
      <EditScopeDialog
        scope={currentScope}
        open={showEditScope}
        onOpenChange={setShowEditScope}
        onDeleteScope={() => {
          setShowEditScope(false);
          setShowDeleteScope(true);
        }}
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
      {currentScope && (
        <GitConfigDialog
          scope={currentScope}
          existingConfig={gitConfigs.get(currentScope.scope.id)}
          open={showGitConfig}
          onOpenChange={setShowGitConfig}
        />
      )}
      {currentScope && currentScope.scope.defaultFolder && (
        <CloneRepositoryDialog
          scope={currentScope}
          open={showCloneRepo}
          onOpenChange={setShowCloneRepo}
          onCloned={async () => {
            // Refresh projects after clone
            if (currentScopeId) {
              await fetchProjects(currentScopeId);
            }
          }}
        />
      )}
      <DeleteProjectDialog
        project={projectToDelete}
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      />
      <MoveProjectDialog
        project={projectToMove?.project ?? null}
        sourceScope={currentScope}
        targetScope={
          projectToMove
            ? scopes.find((s) => s.scope.id === projectToMove.targetScopeId) ??
              null
            : null
        }
        open={!!projectToMove}
        onOpenChange={(open) => !open && setProjectToMove(null)}
        onSuccess={handleMoveSuccess}
      />
    </div>
  );
}
