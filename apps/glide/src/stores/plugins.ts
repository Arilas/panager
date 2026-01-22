/**
 * Plugin state store
 * Manages plugin info and status bar items from backend
 */

import { create } from "zustand";
import type { PluginInfo, PluginState, StatusBarItem } from "../types/plugin";
import * as api from "../lib/tauri-ide";

interface PluginsState {
  // State
  plugins: PluginInfo[];
  statusBarItems: StatusBarItem[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchPlugins: () => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  restartPlugin: (pluginId: string) => Promise<void>;

  // Event handlers (called from usePluginEvents)
  updateStatusBarItem: (item: StatusBarItem) => void;
  removeStatusBarItem: (itemId: string) => void;
  updatePluginState: (
    pluginId: string,
    state: PluginState,
    error?: string
  ) => void;

  // Getters
  getPlugin: (pluginId: string) => PluginInfo | undefined;
  getActivePlugins: () => PluginInfo[];
  getStatusBarItemsByAlignment: (
    alignment: "left" | "right"
  ) => StatusBarItem[];
}

export const usePluginsStore = create<PluginsState>((set, get) => ({
  plugins: [],
  statusBarItems: [],
  loading: false,
  error: null,

  fetchPlugins: async () => {
    set({ loading: true, error: null });
    try {
      const plugins = await api.listPlugins();
      set({ plugins, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to fetch plugins",
      });
    }
  },

  enablePlugin: async (pluginId) => {
    try {
      await api.enablePlugin(pluginId);
      // Refresh plugin list to get updated state
      await get().fetchPlugins();
    } catch (e) {
      console.error("Failed to enable plugin:", e);
    }
  },

  disablePlugin: async (pluginId) => {
    try {
      await api.disablePlugin(pluginId);
      // Refresh plugin list to get updated state
      await get().fetchPlugins();
    } catch (e) {
      console.error("Failed to disable plugin:", e);
    }
  },

  restartPlugin: async (pluginId) => {
    try {
      await api.restartPlugin(pluginId);
      // Refresh plugin list to get updated state
      await get().fetchPlugins();
    } catch (e) {
      console.error("Failed to restart plugin:", e);
    }
  },

  updateStatusBarItem: (item) => {
    set((state) => {
      // Remove existing item with same id, then add new one
      const filtered = state.statusBarItems.filter((i) => i.id !== item.id);
      const items = [...filtered, item].sort(
        (a, b) => b.priority - a.priority
      );
      return { statusBarItems: items };
    });
  },

  removeStatusBarItem: (itemId) => {
    set((state) => ({
      statusBarItems: state.statusBarItems.filter((i) => i.id !== itemId),
    }));
  },

  updatePluginState: (pluginId, newState, error) => {
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.manifest.id === pluginId ? { ...p, state: newState, error } : p
      ),
    }));
  },

  getPlugin: (pluginId) => {
    return get().plugins.find((p) => p.manifest.id === pluginId);
  },

  getActivePlugins: () => {
    return get().plugins.filter((p) => p.state === "active");
  },

  getStatusBarItemsByAlignment: (alignment) => {
    return get().statusBarItems.filter((item) => item.alignment === alignment);
  },
}));
