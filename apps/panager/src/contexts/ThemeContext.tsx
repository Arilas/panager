import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSettingsStore } from "../stores/settings";

interface ThemeContextValue {
  useLiquidGlass: boolean;
  intensity: "subtle" | "medium" | "strong";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings } = useSettingsStore();

  const value = useMemo<ThemeContextValue>(
    () => ({
      useLiquidGlass: settings.liquid_glass_enabled,
      intensity: settings.liquid_glass_intensity,
    }),
    [settings.liquid_glass_enabled, settings.liquid_glass_intensity]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function useLiquidGlass(): boolean {
  const context = useContext(ThemeContext);
  // Fallback to settings store if context not available (for gradual migration)
  if (!context) {
    const { settings } = useSettingsStore.getState();
    return settings.liquid_glass_enabled;
  }
  return context.useLiquidGlass;
}
