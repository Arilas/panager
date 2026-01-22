/**
 * Effective Theme & Liquid Glass Hooks
 *
 * Simple hooks for detecting theme and liquid glass state.
 * These can be used directly without needing IdeSettingsContext.
 */

import { useState, useEffect, useMemo } from "react";
import { useIdeSettingsStore } from "../stores/settings";

export type EffectiveTheme = "light" | "dark";

/** Check if running on macOS 26+ (Tahoe) with native glass support */
function isMacOS26OrHigher(): boolean {
  if (typeof navigator === "undefined" || typeof CSS === "undefined")
    return false;
  const platform = navigator.platform?.toLowerCase() ?? "";
  if (!platform.includes("mac")) return false;
  return CSS.supports("-apple-visual-effect", "-apple-system-glass-material");
}

/** Check if we're on macOS at all */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform?.toLowerCase() ?? "";
  return platform.includes("mac");
}

/**
 * Hook that returns the effective theme based on system preferences.
 * Automatically updates when the system theme changes.
 */
export function useEffectiveTheme(): EffectiveTheme {
  const [theme, setTheme] = useState<EffectiveTheme>(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    // Set initial value
    setTheme(mediaQuery.matches ? "dark" : "light");

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return theme;
}

/**
 * Get the current effective theme synchronously (for non-hook contexts).
 * Note: This won't update when the theme changes - use the hook when possible.
 */
export function getEffectiveTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Hook that returns whether liquid glass effects should be used.
 * Based on the liquidGlassMode setting and platform detection.
 */
export function useLiquidGlass(): boolean {
  const appearance = useIdeSettingsStore(
    (s) => s.settings.general.appearance.liquidGlassMode,
  );

  return useMemo(() => {
    if (appearance === "auto") {
      return isMacOS26OrHigher();
    }
    return appearance;
  }, [appearance]);
}

/**
 * Hook that returns whether macOS 26+ with native glass is supported.
 */
export function useIsMacOS26Supported(): boolean {
  return useMemo(() => isMacOS26OrHigher(), []);
}
