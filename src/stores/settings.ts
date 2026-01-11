import { create } from "zustand";
import * as api from "../lib/tauri";

interface Settings {
  git_refresh_interval: number;
  global_hotkey: string;
  theme: "light" | "dark" | "system";
  default_editor_id: string;
  // Max features
  max_git_integration: boolean;
  max_ssh_integration: boolean;
  // Liquid Glass
  liquid_glass_enabled: boolean;
  liquid_glass_intensity: "subtle" | "medium" | "strong";
}

const defaultSettings: Settings = {
  git_refresh_interval: 900000, // 15 minutes
  global_hotkey: "CmdOrCtrl+Shift+O",
  theme: "system",
  default_editor_id: "",
  // Max features - disabled by default
  max_git_integration: false,
  max_ssh_integration: false,
  // Liquid Glass - enabled by default
  liquid_glass_enabled: true,
  liquid_glass_intensity: "medium",
};

interface SettingsState {
  settings: Settings;
  loading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => Promise<void>;

  // Theme
  getEffectiveTheme: () => "light" | "dark";
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const allSettings = await api.getAllSettings();
      const settings: Settings = {
        git_refresh_interval:
          (allSettings.git_refresh_interval as number) ??
          defaultSettings.git_refresh_interval,
        global_hotkey:
          (allSettings.global_hotkey as string) ?? defaultSettings.global_hotkey,
        theme:
          (allSettings.theme as Settings["theme"]) ?? defaultSettings.theme,
        default_editor_id:
          (allSettings.default_editor_id as string) ??
          defaultSettings.default_editor_id,
        max_git_integration:
          (allSettings.max_git_integration as boolean) ??
          defaultSettings.max_git_integration,
        max_ssh_integration:
          (allSettings.max_ssh_integration as boolean) ??
          defaultSettings.max_ssh_integration,
        liquid_glass_enabled:
          (allSettings.liquid_glass_enabled as boolean) ??
          defaultSettings.liquid_glass_enabled,
        liquid_glass_intensity:
          (allSettings.liquid_glass_intensity as Settings["liquid_glass_intensity"]) ??
          defaultSettings.liquid_glass_intensity,
      };
      set({ settings, loading: false });

      // Apply liquid glass settings
      applyLiquidGlass(settings.liquid_glass_enabled, settings.liquid_glass_intensity);

      // Apply theme
      applyTheme(settings.theme);
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  updateSetting: async (key, value) => {
    try {
      await api.setSetting(key, value);
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));

      // Apply theme if theme setting changed
      if (key === "theme") {
        applyTheme(value as Settings["theme"]);
      }

      // Apply liquid glass settings if changed
      if (key === "liquid_glass_enabled" || key === "liquid_glass_intensity") {
        const state = get();
        applyLiquidGlass(
          key === "liquid_glass_enabled" ? value as boolean : state.settings.liquid_glass_enabled,
          key === "liquid_glass_intensity" ? value as Settings["liquid_glass_intensity"] : state.settings.liquid_glass_intensity
        );
      }
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getEffectiveTheme: () => {
    const { theme } = get().settings;
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme;
  },
}));

function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyLiquidGlass(enabled: boolean, intensity: Settings["liquid_glass_intensity"]) {
  const root = document.documentElement;

  // Remove all intensity classes
  root.classList.remove("glass-blur-sm", "glass-blur-md", "glass-blur-lg", "no-glass");

  if (!enabled) {
    root.classList.add("no-glass");
    return;
  }

  // Apply intensity class
  switch (intensity) {
    case "subtle":
      root.classList.add("glass-blur-sm");
      break;
    case "medium":
      root.classList.add("glass-blur-md");
      break;
    case "strong":
      root.classList.add("glass-blur-lg");
      break;
  }
}

// Listen for system theme changes
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { settings } = useSettingsStore.getState();
      if (settings.theme === "system") {
        applyTheme("system");
      }
    });
}
