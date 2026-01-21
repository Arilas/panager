/**
 * IDE Settings Context
 *
 * Provides appearance settings (liquid glass, accent color) to IDE components.
 * Uses the zustand settings store which persists to backend settings files.
 * Theme is derived from system preferences via CSS media queries.
 */

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  useIdeSettingsStore,
  useSettingsInitialized,
} from "../stores/settings";
import {
  useEffectiveTheme,
  type EffectiveTheme,
} from "../hooks/useEffectiveTheme";
import type { LiquidGlassMode, LiquidGlassIntensity } from "../types/settings";

/** Check if running on macOS 26+ (Tahoe) with native glass support */
export function isMacOS26OrHigher(): boolean {
  if (typeof navigator === "undefined" || typeof CSS === "undefined")
    return false;
  const platform = navigator.platform?.toLowerCase() ?? "";
  if (!platform.includes("mac")) return false;

  // Check for native -apple-visual-effect support
  return CSS.supports("-apple-visual-effect", "-apple-system-glass-material");
}

/** Check if we're on macOS at all */
function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform?.toLowerCase() ?? "";
  return platform.includes("mac");
}

/** Compute effective liquid glass enabled state based on mode */
function computeEffectiveLiquidGlass(mode: LiquidGlassMode): boolean {
  if (mode === "auto") {
    return isMacOS26OrHigher();
  }
  return mode;
}

interface IdeSettingsContextValue {
  effectiveTheme: EffectiveTheme;
  useLiquidGlass: boolean;
  intensity: LiquidGlassIntensity;
  accentColor: string;
  loading: boolean;
  // Settings update function
  updateSettings: (settings: {
    liquidGlassMode?: LiquidGlassMode;
    liquidGlassIntensity?: LiquidGlassIntensity;
    accentColor?: string;
  }) => void;
  // Platform detection
  isMacOS: boolean;
  isMacOS26Supported: boolean;
  // Raw settings for settings UI
  settings: {
    liquidGlassMode: LiquidGlassMode;
    liquidGlassIntensity: LiquidGlassIntensity;
    accentColor: string;
  };
}

const IdeSettingsContext = createContext<IdeSettingsContextValue | null>(null);

export function IdeSettingsProvider({ children }: { children: ReactNode }) {
  const liquidGlassIntensity = useIdeSettingsStore(
    (s) => s.settings.general.appearance.liquidGlassIntensity,
  );
  const accentColor = useIdeSettingsStore(
    (s) => s.settings.general.appearance.accentColor,
  );
  const liquidGlassMode = useIdeSettingsStore(
    (s) => s.settings.general.appearance.liquidGlassMode,
  );
  const initialized = useSettingsInitialized();
  const storeUpdateSetting = useIdeSettingsStore((s) => s.updateSetting);

  // Get effective theme from system preferences
  const effectiveTheme = useEffectiveTheme();

  const useLiquidGlass = computeEffectiveLiquidGlass(liquidGlassMode);

  // Update settings via backend store
  const updateSettings = useCallback(
    async (newSettings: {
      liquidGlassMode?: LiquidGlassMode;
      liquidGlassIntensity?: LiquidGlassIntensity;
      accentColor?: string;
    }) => {
      try {
        // Update each changed setting at the workspace level
        if (newSettings.liquidGlassMode !== undefined) {
          await storeUpdateSetting(
            "general.appearance.liquidGlassMode",
            newSettings.liquidGlassMode,
            "workspace",
          );
        }
        if (newSettings.liquidGlassIntensity !== undefined) {
          await storeUpdateSetting(
            "general.appearance.liquidGlassIntensity",
            newSettings.liquidGlassIntensity,
            "workspace",
          );
        }
        if (newSettings.accentColor !== undefined) {
          await storeUpdateSetting(
            "general.appearance.accentColor",
            newSettings.accentColor,
            "workspace",
          );
        }
      } catch (error) {
        console.error("Failed to update appearance settings:", error);
      }
    },
    [],
  );

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [effectiveTheme]);

  // Apply liquid glass settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all glass classes first
    root.classList.remove(
      "glass-blur-sm",
      "glass-blur-md",
      "glass-blur-lg",
      "no-glass",
    );

    if (!useLiquidGlass) {
      root.classList.add("no-glass");
      return;
    }

    // Apply intensity class
    switch (liquidGlassIntensity) {
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
  }, [useLiquidGlass, liquidGlassIntensity]);

  // Apply accent color to document
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accentColor);
  }, [accentColor]);

  return (
    <IdeSettingsContext.Provider
      value={{
        effectiveTheme,
        useLiquidGlass,
        intensity: liquidGlassIntensity,
        accentColor: accentColor,
        loading: !initialized,
        updateSettings,
        isMacOS: isMacOS(),
        isMacOS26Supported: isMacOS26OrHigher(),
        settings: {
          liquidGlassMode: liquidGlassMode,
          liquidGlassIntensity: liquidGlassIntensity,
          accentColor: accentColor,
        },
      }}
    >
      {children}
    </IdeSettingsContext.Provider>
  );
}

export function useIdeSettingsContext() {
  const context = useContext(IdeSettingsContext);
  if (!context) {
    throw new Error(
      "useIdeSettingsContext must be used within IdeSettingsProvider",
    );
  }
  return context;
}
