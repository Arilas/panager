import { create } from "zustand";
import type {
  CreateScopeLinkRequest,
  CreateScopeRequest,
  ScopeWithLinks,
} from "../types";
import * as api from "../lib/tauri";

interface ScopesState {
  scopes: ScopeWithLinks[];
  currentScopeId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchScopes: () => Promise<void>;
  createScope: (request: CreateScopeRequest) => Promise<void>;
  updateScope: (
    id: string,
    name?: string,
    color?: string,
    icon?: string,
    defaultEditorId?: string
  ) => Promise<void>;
  deleteScope: (id: string) => Promise<void>;
  reorderScopes: (scopeIds: string[]) => Promise<void>;
  setCurrentScope: (id: string | null) => void;

  // Scope Links
  createScopeLink: (request: CreateScopeLinkRequest) => Promise<void>;
  deleteScopeLink: (id: string) => Promise<void>;

  // Helpers
  getCurrentScope: () => ScopeWithLinks | null;
}

export const useScopesStore = create<ScopesState>((set, get) => ({
  scopes: [],
  currentScopeId: null,
  loading: false,
  error: null,

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
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateScope: async (id, name, color, icon, defaultEditorId) => {
    try {
      await api.updateScope(id, name, color, icon, defaultEditorId);
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
                },
              }
            : s
        ),
      }));
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

  getCurrentScope: () => {
    const { scopes, currentScopeId } = get();
    return scopes.find((s) => s.scope.id === currentScopeId) ?? null;
  },
}));
