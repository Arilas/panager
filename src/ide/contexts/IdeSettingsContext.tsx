/**
 * IDE Settings Context
 *
 * Provides app settings (theme, liquid glass) to IDE components.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useIdeSettings } from "../hooks/useIdeSettings";

interface IdeSettingsContextValue {
  effectiveTheme: "light" | "dark";
  useLiquidGlass: boolean;
  intensity: "subtle" | "medium" | "strong";
  loading: boolean;
}

const IdeSettingsContext = createContext<IdeSettingsContextValue | null>(null);

export function IdeSettingsProvider({ children }: { children: ReactNode }) {
  const { effectiveTheme, useLiquidGlass, intensity, loading } = useIdeSettings();

  return (
    <IdeSettingsContext.Provider
      value={{ effectiveTheme, useLiquidGlass, intensity, loading }}
    >
      {children}
    </IdeSettingsContext.Provider>
  );
}

export function useIdeSettingsContext() {
  const context = useContext(IdeSettingsContext);
  if (!context) {
    throw new Error("useIdeSettingsContext must be used within IdeSettingsProvider");
  }
  return context;
}
