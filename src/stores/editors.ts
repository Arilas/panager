import { create } from "zustand";
import type { Editor } from "../types";
import * as api from "../lib/tauri";

interface EditorsState {
  editors: Editor[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchEditors: () => Promise<void>;
  syncEditors: () => Promise<void>;
  addEditor: (name: string, command: string, icon?: string) => Promise<void>;
  deleteEditor: (id: string) => Promise<void>;

  // Helpers
  getEditorById: (id: string) => Editor | undefined;
  getDefaultEditor: () => Editor | undefined;
}

export const useEditorsStore = create<EditorsState>((set, get) => ({
  editors: [],
  loading: false,
  error: null,

  fetchEditors: async () => {
    set({ loading: true, error: null });
    try {
      const editors = await api.getEditors();
      set({ editors, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  syncEditors: async () => {
    set({ loading: true, error: null });
    try {
      const editors = await api.syncEditors();
      set({ editors, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  addEditor: async (name, command, icon) => {
    try {
      const editor = await api.addEditor(name, command, icon);
      set((state) => ({ editors: [...state.editors, editor] }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteEditor: async (id) => {
    try {
      await api.deleteEditor(id);
      set((state) => ({
        editors: state.editors.filter((e) => e.id !== id),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getEditorById: (id) => {
    return get().editors.find((e) => e.id === id);
  },

  getDefaultEditor: () => {
    const { editors } = get();
    // Prefer VS Code or Cursor as default
    return (
      editors.find((e) => e.command === "code") ||
      editors.find((e) => e.command === "cursor") ||
      editors[0]
    );
  },
}));
