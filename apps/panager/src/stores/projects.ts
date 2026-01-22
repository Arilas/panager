import { create } from "zustand";
import type {
  CreateProjectCommandRequest,
  CreateProjectGroupRequest,
  CreateProjectLinkRequest,
  CreateProjectRequest,
  ProjectCommand,
  ProjectGroup,
  ProjectLink,
  ProjectStatistics,
  ProjectWithStatus,
} from "../types";
import * as api from "../lib/tauri";

interface ProjectsState {
  projects: ProjectWithStatus[];
  allProjects: ProjectWithStatus[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];

  // Actions
  fetchProjects: (scopeId: string) => Promise<void>;
  fetchAllProjects: () => Promise<void>;
  createProject: (request: CreateProjectRequest) => Promise<void>;
  updateProject: (
    id: string,
    name?: string,
    preferredEditorId?: string,
    defaultBranch?: string,
    workspaceFile?: string
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteProjectWithFolder: (id: string) => Promise<void>;
  moveProjectToScope: (projectId: string, newScopeId: string) => Promise<void>;
  moveProjectToScopeWithFolder: (
    projectId: string,
    newScopeId: string,
    targetFolder?: string,
    folderName?: string
  ) => Promise<void>;

  // Tags
  addTag: (projectId: string, tag: string) => Promise<void>;
  removeTag: (projectId: string, tag: string) => Promise<void>;

  // Git
  refreshGitStatus: (projectId: string, projectPath: string) => Promise<void>;
  gitPull: (projectPath: string) => Promise<string>;
  gitPush: (projectPath: string) => Promise<string>;

  // Editor
  openInEditor: (
    editorCommand: string,
    projectPath: string,
    workspaceFile?: string
  ) => Promise<void>;
  updateLastOpened: (projectId: string) => Promise<void>;

  // Scanning
  scanFolder: (folderPath: string) => Promise<string[]>;

  // Search & Filter
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  getFilteredProjects: () => ProjectWithStatus[];
  getAllTags: () => string[];

  // Project Links
  createProjectLink: (request: CreateProjectLinkRequest) => Promise<void>;
  deleteProjectLink: (linkId: string) => Promise<void>;
  getProjectLinks: (projectId: string) => Promise<ProjectLink[]>;

  // Project Groups
  createProjectGroup: (
    request: CreateProjectGroupRequest
  ) => Promise<ProjectGroup>;
  updateProjectGroup: (
    groupId: string,
    name?: string,
    color?: string
  ) => Promise<void>;
  deleteProjectGroup: (groupId: string) => Promise<void>;
  getProjectGroups: (scopeId: string) => Promise<ProjectGroup[]>;
  assignProjectToGroup: (
    projectId: string,
    groupId: string | null
  ) => Promise<void>;

  // Project Commands
  createProjectCommand: (
    request: CreateProjectCommandRequest
  ) => Promise<ProjectCommand>;
  updateProjectCommand: (
    commandId: string,
    name?: string,
    command?: string,
    description?: string,
    workingDirectory?: string
  ) => Promise<void>;
  deleteProjectCommand: (commandId: string) => Promise<void>;
  getProjectCommands: (projectId: string) => Promise<ProjectCommand[]>;
  executeProjectCommand: (
    commandId: string,
    projectPath: string
  ) => Promise<string>;

  // Project Metadata
  updateProjectNotes: (
    projectId: string,
    notes: string | null
  ) => Promise<void>;
  updateProjectDescription: (
    projectId: string,
    description: string | null
  ) => Promise<void>;
  pinProject: (projectId: string) => Promise<void>;
  unpinProject: (projectId: string) => Promise<void>;

  // Project Statistics
  fetchProjectStatistics: (
    projectId: string,
    projectPath: string
  ) => Promise<ProjectStatistics>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  allProjects: [],
  loading: false,
  error: null,
  searchQuery: "",
  selectedTags: [],

  fetchProjects: async (scopeId) => {
    set({ loading: true, error: null });
    try {
      console.log("Store: fetching projects for scope:", scopeId);
      const projects = await api.getProjects(scopeId);
      console.log("Store: received projects:", projects.length, projects);
      set({ projects, loading: false });
    } catch (error) {
      console.error("Store: fetch projects error:", error);
      set({ error: String(error), loading: false });
    }
  },

  fetchAllProjects: async () => {
    set({ loading: true, error: null });
    try {
      const allProjects = await api.getAllProjects();
      set({ allProjects, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  createProject: async (request) => {
    try {
      const project = await api.createProject(request);
      const newProjectWithStatus: ProjectWithStatus = {
        project,
        tags: [],
        gitStatus: null,
        links: [],
        group: null,
        statistics: null,
      };
      set((state) => ({
        projects: [newProjectWithStatus, ...state.projects],
        allProjects: [newProjectWithStatus, ...state.allProjects],
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateProject: async (
    id,
    name,
    preferredEditorId,
    defaultBranch,
    workspaceFile
  ) => {
    try {
      await api.updateProject(
        id,
        name,
        preferredEditorId,
        defaultBranch,
        workspaceFile
      );
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === id
          ? {
              ...p,
              project: {
                ...p.project,
                ...(name && { name }),
                ...(preferredEditorId !== undefined && {
                  preferredEditorId: preferredEditorId,
                }),
                ...(defaultBranch !== undefined && {
                  defaultBranch: defaultBranch,
                }),
                ...(workspaceFile !== undefined && {
                  workspaceFile: workspaceFile,
                }),
              },
            }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProject: async (id) => {
    try {
      await api.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.project.id !== id),
        allProjects: state.allProjects.filter((p) => p.project.id !== id),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProjectWithFolder: async (id) => {
    try {
      await api.deleteProjectWithFolder(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.project.id !== id),
        allProjects: state.allProjects.filter((p) => p.project.id !== id),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  moveProjectToScope: async (projectId, newScopeId) => {
    try {
      await api.moveProjectToScope(projectId, newScopeId);
      set((state) => ({
        projects: state.projects.filter((p) => p.project.id !== projectId),
        allProjects: state.allProjects.map((p) =>
          p.project.id === projectId
            ? {
                ...p,
                project: { ...p.project, scopeId: newScopeId, isTemp: false },
              }
            : p
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  moveProjectToScopeWithFolder: async (
    projectId,
    newScopeId,
    targetFolder,
    folderName
  ) => {
    try {
      const newPath = await api.moveProjectToScopeWithFolder(
        projectId,
        newScopeId,
        targetFolder,
        folderName
      );
      set((state) => ({
        projects: state.projects.filter((p) => p.project.id !== projectId),
        allProjects: state.allProjects.map((p) =>
          p.project.id === projectId
            ? {
                ...p,
                project: {
                  ...p.project,
                  scopeId: newScopeId,
                  path: newPath,
                  isTemp: false,
                },
              }
            : p
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  addTag: async (projectId, tag) => {
    try {
      await api.addProjectTag(projectId, tag);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, tags: [...new Set([...p.tags, tag])] }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  removeTag: async (projectId, tag) => {
    try {
      await api.removeProjectTag(projectId, tag);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, tags: p.tags.filter((t) => t !== tag) }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  refreshGitStatus: async (projectId, projectPath) => {
    try {
      const gitStatus = await api.refreshGitStatus(projectId, projectPath);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId ? { ...p, gitStatus: gitStatus } : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      console.error("Failed to refresh git status:", error);
    }
  },

  gitPull: async (projectPath) => {
    return api.gitPull(projectPath);
  },

  gitPush: async (projectPath) => {
    return api.gitPush(projectPath);
  },

  openInEditor: async (editorCommand, projectPath, workspaceFile) => {
    try {
      await api.openInEditor(editorCommand, projectPath, workspaceFile);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateLastOpened: async (projectId) => {
    try {
      await api.updateProjectLastOpened(projectId);
      const now = new Date().toISOString();
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, project: { ...p.project, lastOpenedAt: now } }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      console.error("Failed to update last opened:", error);
    }
  },

  scanFolder: async (folderPath) => {
    return api.scanFolderForProjects(folderPath);
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags });
  },

  getFilteredProjects: () => {
    const { projects, searchQuery, selectedTags } = get();
    let filtered = projects;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.project.name.toLowerCase().includes(query) ||
          p.project.path.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((p) =>
        selectedTags.every((tag) => p.tags.includes(tag))
      );
    }

    return filtered;
  },

  getAllTags: () => {
    const { projects } = get();
    const tags = new Set<string>();
    projects.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  },

  // Project Links
  createProjectLink: async (request) => {
    try {
      await api.createProjectLink(request);
      // Refresh projects to get updated links
      const { projects } = get();
      const project = projects.find((p) => p.project.id === request.projectId);
      if (project) {
        await get().refreshGitStatus(project.project.id, project.project.path);
      }
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProjectLink: async (linkId) => {
    try {
      await api.deleteProjectLink(linkId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getProjectLinks: async (projectId) => {
    return api.getProjectLinks(projectId);
  },

  // Project Groups
  createProjectGroup: async (request) => {
    try {
      return await api.createProjectGroup(request);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateProjectGroup: async (groupId, name, color) => {
    try {
      await api.updateProjectGroup(groupId, name, color);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProjectGroup: async (groupId) => {
    try {
      await api.deleteProjectGroup(groupId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getProjectGroups: async (scopeId) => {
    return api.getProjectGroups(scopeId);
  },

  assignProjectToGroup: async (projectId, groupId) => {
    try {
      await api.assignProjectToGroup(projectId, groupId);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? {
              ...p,
              project: { ...p.project, groupId: groupId ?? null },
            }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  // Project Commands
  createProjectCommand: async (request) => {
    try {
      return await api.createProjectCommand(request);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateProjectCommand: async (
    commandId,
    name,
    command,
    description,
    workingDirectory
  ) => {
    try {
      await api.updateProjectCommand(
        commandId,
        name,
        command,
        description,
        workingDirectory
      );
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteProjectCommand: async (commandId) => {
    try {
      await api.deleteProjectCommand(commandId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getProjectCommands: async (projectId) => {
    return api.getProjectCommands(projectId);
  },

  executeProjectCommand: async (commandId, projectPath) => {
    try {
      return await api.executeProjectCommand(commandId, projectPath);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  // Project Metadata
  updateProjectNotes: async (projectId, notes) => {
    try {
      await api.updateProjectNotes(projectId, notes);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, project: { ...p.project, notes: notes ?? null } }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateProjectDescription: async (projectId, description) => {
    try {
      await api.updateProjectDescription(projectId, description);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? {
              ...p,
              project: { ...p.project, description: description ?? null },
            }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  pinProject: async (projectId) => {
    try {
      await api.pinProject(projectId);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, project: { ...p.project, isPinned: true } }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  unpinProject: async (projectId) => {
    try {
      await api.unpinProject(projectId);
      const updateFn = (p: ProjectWithStatus) =>
        p.project.id === projectId
          ? { ...p, project: { ...p.project, isPinned: false } }
          : p;

      set((state) => ({
        projects: state.projects.map(updateFn),
        allProjects: state.allProjects.map(updateFn),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  // Project Statistics
  fetchProjectStatistics: async (_projectId, projectPath) => {
    try {
      return await api.getProjectStatistics(projectPath);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
}));
