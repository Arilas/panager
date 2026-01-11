import { create } from "zustand";
import * as api from "../lib/tauri";

interface Settings {
  git_refresh_interval: number;
  temp_project_cleanup_days: number;
  temp_project_path: string;
  global_hotkey: string;
  theme: "light" | "dark" | "system";
  default_editor_id: string;
  // Max features
  max_git_integration: boolean;
  max_ssh_integration: boolean;
}

const defaultSettings: Settings = {
  git_refresh_interval: 900000, // 15 minutes
  temp_project_cleanup_days: 7,
  temp_project_path: "",
  global_hotkey: "CmdOrCtrl+Shift+O",
  theme: "system",
  default_editor_id: "",
  // Max features - disabled by default
  max_git_integration: false,
  max_ssh_integration: false,
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
        temp_project_cleanup_days:
          (allSettings.temp_project_cleanup_days as number) ??
          defaultSettings.temp_project_cleanup_days,
        temp_project_path:
          (allSettings.temp_project_path as string) ??
          defaultSettings.temp_project_path,
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
      };
      set({ settings, loading: false });

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
