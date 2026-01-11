import { create } from "zustand";
import type { CreateProjectRequest, ProjectWithStatus } from "../types";
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
    preferredEditorId?: string
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteProjectWithFolder: (id: string) => Promise<void>;
  moveProjectToScope: (projectId: string, newScopeId: string) => Promise<void>;

  // Tags
  addTag: (projectId: string, tag: string) => Promise<void>;
  removeTag: (projectId: string, tag: string) => Promise<void>;

  // Git
  refreshGitStatus: (projectId: string, projectPath: string) => Promise<void>;
  gitPull: (projectPath: string) => Promise<string>;
  gitPush: (projectPath: string) => Promise<string>;

  // Editor
  openInEditor: (editorCommand: string, projectPath: string) => Promise<void>;
  updateLastOpened: (projectId: string) => Promise<void>;

  // Scanning
  scanFolder: (folderPath: string) => Promise<string[]>;

  // Search & Filter
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  getFilteredProjects: () => ProjectWithStatus[];
  getAllTags: () => string[];
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

  updateProject: async (id, name, preferredEditorId) => {
    try {
      await api.updateProject(id, name, preferredEditorId);
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

  openInEditor: async (editorCommand, projectPath) => {
    try {
      await api.openInEditor(editorCommand, projectPath);
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
}));
