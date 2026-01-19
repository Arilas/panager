/**
 * IDE Settings Store
 *
 * Manages IDE settings state with support for the three-tier hierarchy:
 * User → Scope → Workspace
 *
 * All JSONC parsing and merging is handled by the Rust backend.
 * This store just caches and distributes the settings to the UI.
 */

import { create } from "zustand";
import * as api from "../lib/tauri-ide";
import type {
  IdeSettings,
  PartialIdeSettings,
  SettingsLevel,
} from "../types/settings";

interface IdeSettingsState {
  // Merged effective settings (from backend) - for IDE components to use
  settings: IdeSettings;

  // Settings dialog: merged settings up to a specific level
  // Used to display what settings look like at each level
  dialogSettings: IdeSettings;
  dialogLevel: SettingsLevel;

  // For settings dialog: raw settings at each level (to detect overrides)
  levelSettings: {
    user: PartialIdeSettings | null;
    scope: PartialIdeSettings | null;
    workspace: PartialIdeSettings | null;
  };

  // Loading states
  loading: boolean;
  dialogLoading: boolean;
  levelLoading: Record<SettingsLevel, boolean>;

  // Error state
  error: string | null;

  // Context for settings (needed for API calls)
  projectPath: string | null;
  scopeDefaultFolder: string | null;

  // Whether settings have been initialized
  initialized: boolean;

  // Actions
  initialize: (
    projectPath: string,
    scopeDefaultFolder: string | null
  ) => Promise<void>;
  loadSettings: () => Promise<void>;
  loadSettingsForLevel: (level: SettingsLevel) => Promise<void>;
  loadLevelSettings: (level: SettingsLevel) => Promise<void>;
  loadAllLevelSettings: () => Promise<void>;
  updateSetting: (
    key: string,
    value: unknown,
    level: SettingsLevel
  ) => Promise<void>;
  deleteSetting: (key: string, level: SettingsLevel) => Promise<void>;

  // Helpers
  getSetting: <T>(key: string) => T | undefined;
  hasLevelOverride: (key: string, level: SettingsLevel) => boolean;
  getOverrideLevel: (key: string, currentLevel: SettingsLevel) => SettingsLevel | null;
}

// Default settings (matches Rust defaults)
const defaultSettings: IdeSettings = {
  general: {
    activityBar: { position: "left" },
    sidebar: { position: "left" },
    git: { defaultView: "tree" },
  },
  editor: {
    fontSize: 13,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "off",
    wordWrapColumn: 80,
    lineNumbers: "on",
    minimap: { enabled: true, side: "right" },
    renderWhitespace: "selection",
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: "active", indentation: true },
    cursorBlinking: "smooth",
    cursorStyle: "line",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    lineHeight: 0,
    letterSpacing: 0,
    padding: { top: 8, bottom: 0 },
  },
  languageOverrides: {},
  git: {
    blame: { enabled: true },
    codeLens: { enabled: true },
    gutter: { enabled: true },
    autoRefresh: true,
    refreshInterval: 30000,
  },
  behavior: {
    formatOnSave: {
      enabled: false,
      formatters: [],
    },
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    autoSaveDelay: 0,
  },
};

export const useIdeSettingsStore = create<IdeSettingsState>((set, get) => ({
  // Initial state
  settings: defaultSettings,
  dialogSettings: defaultSettings,
  dialogLevel: "workspace",
  levelSettings: {
    user: null,
    scope: null,
    workspace: null,
  },
  loading: false,
  dialogLoading: false,
  levelLoading: {
    user: false,
    scope: false,
    workspace: false,
  },
  error: null,
  projectPath: null,
  scopeDefaultFolder: null,
  initialized: false,

  // Initialize with project context
  initialize: async (projectPath, scopeDefaultFolder) => {
    set({
      projectPath,
      scopeDefaultFolder,
      loading: true,
      error: null,
    });

    try {
      const settings = await api.loadSettings(projectPath, scopeDefaultFolder);
      set({
        settings,
        initialized: true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load IDE settings:", error);
      set({
        error: String(error),
        loading: false,
        initialized: true, // Still mark as initialized to use defaults
      });
    }
  },

  // Reload settings from backend
  loadSettings: async () => {
    const { projectPath, scopeDefaultFolder } = get();
    if (!projectPath) {
      console.warn("Cannot load settings: no project path set");
      return;
    }

    set({ loading: true, error: null });

    try {
      const settings = await api.loadSettings(projectPath, scopeDefaultFolder);
      set({ settings, loading: false });
    } catch (error) {
      console.error("Failed to reload IDE settings:", error);
      set({ error: String(error), loading: false });
    }
  },

  // Load merged settings up to a specific level (for settings dialog display)
  loadSettingsForLevel: async (level) => {
    const { projectPath, scopeDefaultFolder } = get();
    if (!projectPath) {
      console.warn("Cannot load settings: no project path set");
      return;
    }

    set({ dialogLoading: true, dialogLevel: level, error: null });

    try {
      const dialogSettings = await api.loadSettingsForLevel(
        level,
        projectPath,
        scopeDefaultFolder
      );
      set({ dialogSettings, dialogLoading: false });
    } catch (error) {
      console.error(`Failed to load settings for level ${level}:`, error);
      set({ error: String(error), dialogLoading: false });
    }
  },

  // Load raw settings for a specific level (for detecting overrides)
  loadLevelSettings: async (level) => {
    const { projectPath, scopeDefaultFolder, levelLoading } = get();

    set({
      levelLoading: { ...levelLoading, [level]: true },
    });

    try {
      const levelSettingsData = await api.getSettingsForLevel(
        level,
        projectPath,
        scopeDefaultFolder
      );
      set((state) => ({
        levelSettings: {
          ...state.levelSettings,
          [level]: levelSettingsData,
        },
        levelLoading: { ...state.levelLoading, [level]: false },
      }));
    } catch (error) {
      console.error(`Failed to load ${level} settings:`, error);
      set((state) => ({
        levelLoading: { ...state.levelLoading, [level]: false },
        error: String(error),
      }));
    }
  },

  // Load raw settings for all levels (for detecting overrides)
  loadAllLevelSettings: async () => {
    const { projectPath, scopeDefaultFolder } = get();
    if (!projectPath) return;

    const levels: SettingsLevel[] = ["user", "scope", "workspace"];

    try {
      const results = await Promise.all(
        levels.map((level) =>
          api.getSettingsForLevel(level, projectPath, scopeDefaultFolder)
        )
      );

      set({
        levelSettings: {
          user: results[0],
          scope: results[1],
          workspace: results[2],
        },
      });
    } catch (error) {
      console.error("Failed to load all level settings:", error);
    }
  },

  // Update a setting at a specific level
  updateSetting: async (key, value, level) => {
    const { projectPath, scopeDefaultFolder } = get();

    try {
      await api.updateSetting(level, key, value, projectPath, scopeDefaultFolder);

      // Reload merged settings to get updated effective values
      const settings = await api.loadSettings(
        projectPath!,
        scopeDefaultFolder
      );
      set({ settings });

      // Also update the level-specific cache if it's loaded
      const levelSettingsData = await api.getSettingsForLevel(
        level,
        projectPath,
        scopeDefaultFolder
      );
      set((state) => ({
        levelSettings: {
          ...state.levelSettings,
          [level]: levelSettingsData,
        },
      }));
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      set({ error: String(error) });
      throw error;
    }
  },

  // Delete a setting at a specific level (revert to lower level)
  deleteSetting: async (key, level) => {
    const { projectPath, scopeDefaultFolder } = get();

    try {
      await api.deleteSetting(level, key, projectPath, scopeDefaultFolder);

      // Reload merged settings to get updated effective values
      const settings = await api.loadSettings(
        projectPath!,
        scopeDefaultFolder
      );
      set({ settings });

      // Also update the level-specific cache if it's loaded
      const levelSettingsData = await api.getSettingsForLevel(
        level,
        projectPath,
        scopeDefaultFolder
      );
      set((state) => ({
        levelSettings: {
          ...state.levelSettings,
          [level]: levelSettingsData,
        },
      }));
    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
      set({ error: String(error) });
      throw error;
    }
  },

  // Get a setting value using dot-notation path
  getSetting: <T>(key: string): T | undefined => {
    const { settings } = get();
    const parts = key.split(".");

    let current: unknown = settings;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as T;
  },

  // Check if a setting is overridden at a specific level
  hasLevelOverride: (key: string, level: SettingsLevel): boolean => {
    const { levelSettings } = get();
    const levelData = levelSettings[level];
    if (!levelData) {
      return false;
    }

    // Key format is "section.property" where property may contain dots
    const [section, ...rest] = key.split(".");
    const property = rest.join(".");

    const sectionData = levelData[section as keyof typeof levelData];
    if (!sectionData || typeof sectionData !== "object") {
      return false;
    }

    return property in (sectionData as Record<string, unknown>);
  },

  // Find which level (other than current) has an override for a setting
  // Returns the level name if found, null otherwise
  getOverrideLevel: (key: string, currentLevel: SettingsLevel): SettingsLevel | null => {
    const { levelSettings } = get();
    const levels: SettingsLevel[] = ["user", "scope", "workspace"];

    // Key format is "section.property" where property may contain dots
    const [section, ...rest] = key.split(".");
    const property = rest.join(".");

    for (const level of levels) {
      if (level === currentLevel) continue;

      const levelData = levelSettings[level];
      if (!levelData) continue;

      const sectionData = levelData[section as keyof typeof levelData];
      if (sectionData && typeof sectionData === "object" && property in (sectionData as Record<string, unknown>)) {
        return level;
      }
    }

    return null;
  },
}));

// Selector hooks for common settings (effective merged settings for IDE)
export const useEditorSettings = () =>
  useIdeSettingsStore((state) => state.settings.editor);

export const useGitSettings = () =>
  useIdeSettingsStore((state) => state.settings.git);

export const useGeneralSettings = () =>
  useIdeSettingsStore((state) => state.settings.general);

export const useBehaviorSettings = () =>
  useIdeSettingsStore((state) => state.settings.behavior);

export const useSettingsInitialized = () =>
  useIdeSettingsStore((state) => state.initialized);

export const useSettingsLoading = () =>
  useIdeSettingsStore((state) => state.loading);

// Selector hooks for dialog settings (level-specific merged settings)
export const useDialogGeneralSettings = () =>
  useIdeSettingsStore((state) => state.dialogSettings.general);

export const useDialogEditorSettings = () =>
  useIdeSettingsStore((state) => state.dialogSettings.editor);

export const useDialogGitSettings = () =>
  useIdeSettingsStore((state) => state.dialogSettings.git);

export const useDialogBehaviorSettings = () =>
  useIdeSettingsStore((state) => state.dialogSettings.behavior);

export const useDialogLoading = () =>
  useIdeSettingsStore((state) => state.dialogLoading);
