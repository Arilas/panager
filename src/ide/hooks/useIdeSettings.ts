/**
 * IDE Settings Hook
 *
 * Loads and applies app settings (theme, liquid glass) in the IDE window.
 * Mirrors the main app's settings store functionality.
 */

import { useEffect, useState } from "react";
import * as api from "../../lib/tauri";

interface IdeSettings {
  theme: "light" | "dark" | "system";
  liquidGlassEnabled: boolean;
  liquidGlassIntensity: "subtle" | "medium" | "strong";
}

const defaultSettings: IdeSettings = {
  theme: "system",
  liquidGlassEnabled: true,
  liquidGlassIntensity: "medium",
};

export function useIdeSettings() {
  const [settings, setSettings] = useState<IdeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Compute derived values
  const effectiveTheme = (() => {
    if (settings.theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return settings.theme;
  })();

  const useLiquidGlass = settings.liquidGlassEnabled;

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const allSettings = await api.getAllSettings();
        setSettings({
          theme: (allSettings.theme as IdeSettings["theme"]) ?? defaultSettings.theme,
          liquidGlassEnabled:
            (allSettings.liquid_glass_enabled as boolean) ?? defaultSettings.liquidGlassEnabled,
          liquidGlassIntensity:
            (allSettings.liquid_glass_intensity as IdeSettings["liquidGlassIntensity"]) ??
            defaultSettings.liquidGlassIntensity,
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

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
    root.classList.remove("glass-blur-sm", "glass-blur-md", "glass-blur-lg", "no-glass");

    if (!settings.liquidGlassEnabled) {
      root.classList.add("no-glass");
      return;
    }

    // Apply intensity class
    switch (settings.liquidGlassIntensity) {
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
  }, [settings.liquidGlassEnabled, settings.liquidGlassIntensity]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings.theme]);

  return {
    settings,
    loading,
    effectiveTheme,
    useLiquidGlass,
    intensity: settings.liquidGlassIntensity,
  };
}
