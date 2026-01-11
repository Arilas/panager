import { create } from "zustand";
import type {
  CreateScopeLinkRequest,
  CreateScopeRequest,
  IgnoredFolderWarning,
  ProjectFolderWarning,
  ScopeGitConfig,
  ScopeWithLinks,
} from "../types";
import * as api from "../lib/tauri";

interface ScopesState {
  scopes: ScopeWithLinks[];
  currentScopeId: string | null;
  loading: boolean;
  error: string | null;

  // Max features state
  folderWarnings: Map<string, ProjectFolderWarning[]>;
  ignoredWarnings: Map<string, IgnoredFolderWarning[]>;
  gitConfigs: Map<string, ScopeGitConfig>;

  // Actions
  fetchScopes: () => Promise<void>;
  createScope: (request: CreateScopeRequest) => Promise<void>;
  updateScope: (
    id: string,
    name?: string,
    color?: string,
    icon?: string,
    defaultEditorId?: string,
    defaultFolder?: string,
    folderScanInterval?: number,
    sshAlias?: string
  ) => Promise<void>;
  deleteScope: (id: string) => Promise<void>;
  reorderScopes: (scopeIds: string[]) => Promise<void>;
  setCurrentScope: (id: string | null) => void;

  // Scope Links
  createScopeLink: (request: CreateScopeLinkRequest) => Promise<void>;
  deleteScopeLink: (id: string) => Promise<void>;

  // Folder Warnings
  fetchFolderWarnings: (scopeId: string) => Promise<void>;
  ignoreFolderWarning: (scopeId: string, projectPath: string) => Promise<void>;
  scanScopeFolder: (scopeId: string) => Promise<string[]>;
  moveProjectToScopeFolder: (projectId: string) => Promise<string>;

  // Git Config
  fetchGitConfig: (scopeId: string) => Promise<void>;
  refreshGitConfig: (scopeId: string) => Promise<void>;

  // Helpers
  getCurrentScope: () => ScopeWithLinks | null;
}

export const useScopesStore = create<ScopesState>((set, get) => ({
  scopes: [],
  currentScopeId: null,
  loading: false,
  error: null,
  folderWarnings: new Map(),
  ignoredWarnings: new Map(),
  gitConfigs: new Map(),

  fetchScopes: async () => {
    set({ loading: true, error: null });
    try {
      const scopes = await api.getScopes();
      set({ scopes, loading: false });

      // Set first scope as current if none selected
      if (!get().currentScopeId && scopes.length > 0) {
        set({ currentScopeId: scopes[0].scope.id });
      }
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  createScope: async (request) => {
    try {
      const scope = await api.createScope(request);
      const newScopeWithLinks: ScopeWithLinks = { scope, links: [] };
      set((state) => ({
        scopes: [...state.scopes, newScopeWithLinks],
        currentScopeId: scope.id,
      }));

      // If defaultFolder was set, try to discover existing git config
      if (request.defaultFolder) {
        const config = await api.discoverScopeGitConfig(scope.id);
        if (config) {
          set((state) => ({
            gitConfigs: new Map(state.gitConfigs).set(scope.id, config),
          }));
        }
      }
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateScope: async (id, name, color, icon, defaultEditorId, defaultFolder, folderScanInterval, sshAlias) => {
    try {
      await api.updateScope(id, name, color, icon, defaultEditorId, defaultFolder, folderScanInterval, sshAlias);
      set((state) => ({
        scopes: state.scopes.map((s) =>
          s.scope.id === id
            ? {
                ...s,
                scope: {
                  ...s.scope,
                  ...(name && { name }),
                  ...(color !== undefined && { color }),
                  ...(icon !== undefined && { icon }),
                  ...(defaultEditorId !== undefined && {
                    defaultEditorId: defaultEditorId,
                  }),
                  ...(defaultFolder !== undefined && { defaultFolder }),
                  ...(folderScanInterval !== undefined && { folderScanInterval }),
                  ...(sshAlias !== undefined && { sshAlias }),
                },
              }
            : s
        ),
      }));

      // If defaultFolder was updated, try to discover existing git config
      if (defaultFolder !== undefined && defaultFolder) {
        const config = await api.discoverScopeGitConfig(id);
        if (config) {
          set((state) => ({
            gitConfigs: new Map(state.gitConfigs).set(id, config),
          }));
        }
      }
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteScope: async (id) => {
    try {
      await api.deleteScope(id);
      set((state) => {
        const newScopes = state.scopes.filter((s) => s.scope.id !== id);
        return {
          scopes: newScopes,
          currentScopeId:
            state.currentScopeId === id
              ? newScopes[0]?.scope.id ?? null
              : state.currentScopeId,
        };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  reorderScopes: async (scopeIds) => {
    try {
      await api.reorderScopes(scopeIds);
      set((state) => {
        const scopeMap = new Map(state.scopes.map((s) => [s.scope.id, s]));
        const reorderedScopes = scopeIds
          .map((id) => scopeMap.get(id))
          .filter((s): s is ScopeWithLinks => s !== undefined);
        return { scopes: reorderedScopes };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  setCurrentScope: (id) => {
    set({ currentScopeId: id });
  },

  createScopeLink: async (request) => {
    try {
      const link = await api.createScopeLink(request);
      set((state) => ({
        scopes: state.scopes.map((s) =>
          s.scope.id === request.scopeId
            ? { ...s, links: [...s.links, link] }
            : s
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteScopeLink: async (id) => {
    try {
      await api.deleteScopeLink(id);
      set((state) => ({
        scopes: state.scopes.map((s) => ({
          ...s,
          links: s.links.filter((l) => l.id !== id),
        })),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  // Folder Warnings
  fetchFolderWarnings: async (scopeId) => {
    try {
      const warnings = await api.getProjectsOutsideFolder(scopeId);
      const ignored = await api.getIgnoredWarnings(scopeId);
      set((state) => ({
        folderWarnings: new Map(state.folderWarnings).set(scopeId, warnings),
        ignoredWarnings: new Map(state.ignoredWarnings).set(scopeId, ignored),
      }));
    } catch (error) {
      console.error("Failed to fetch folder warnings:", error);
    }
  },

  ignoreFolderWarning: async (scopeId, projectPath) => {
    try {
      await api.ignoreFolderWarning(scopeId, projectPath);
      // Remove from warnings list
      set((state) => {
        const warnings = state.folderWarnings.get(scopeId) ?? [];
        return {
          folderWarnings: new Map(state.folderWarnings).set(
            scopeId,
            warnings.filter((w) => w.projectPath !== projectPath)
          ),
        };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  scanScopeFolder: async (scopeId) => {
    try {
      const added = await api.scanScopeFolder(scopeId);
      // Refresh folder warnings after scan
      await get().fetchFolderWarnings(scopeId);
      return added;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  moveProjectToScopeFolder: async (projectId) => {
    try {
      const newPath = await api.moveProjectToScopeFolder(projectId);
      return newPath;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  // Git Config
  fetchGitConfig: async (scopeId) => {
    try {
      const config = await api.getScopeGitIdentity(scopeId);
      if (config) {
        set((state) => ({
          gitConfigs: new Map(state.gitConfigs).set(scopeId, config),
        }));
      }
    } catch (error) {
      console.error("Failed to fetch git config:", error);
    }
  },

  refreshGitConfig: async (scopeId) => {
    try {
      await api.refreshScopeGitIdentity(scopeId);
      await get().fetchGitConfig(scopeId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getCurrentScope: () => {
    const { scopes, currentScopeId } = get();
    return scopes.find((s) => s.scope.id === currentScopeId) ?? null;
  },
}));
