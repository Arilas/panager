import { create } from "zustand";
import type { Editor } from "../types";
import * as api from "../lib/tauri";
import { useSettingsStore } from "./settings";

interface EditorsState {
  editors: Editor[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchEditors: () => Promise<void>;
  syncEditors: () => Promise<void>;
  addEditor: (name: string, command: string, icon?: string) => Promise<void>;

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

  getEditorById: (id) => {
    return get().editors.find((e) => e.id === id);
  },

  getDefaultEditor: () => {
    const { editors } = get();
    const { settings } = useSettingsStore.getState();

    // First check if user has set a default editor
    if (settings.default_editor_id) {
      const defaultEditor = editors.find((e) => e.id === settings.default_editor_id);
      if (defaultEditor?.isAvailable) {
        return defaultEditor;
      }
    }

    // Fallback: prefer VS Code or Cursor
    return (
      editors.find((e) => e.command === "code" && e.isAvailable) ||
      editors.find((e) => e.command === "cursor" && e.isAvailable) ||
      editors.find((e) => e.isAvailable) ||
      editors[0]
    );
  },
}));
