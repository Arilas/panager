/**
 * Main IDE state store
 */

import { create } from "zustand";
import type { IdeProjectContext, SidebarPanel, CursorPosition } from "../types";

interface IdeState {
  // Project context
  projectContext: IdeProjectContext | null;

  // UI state
  activePanel: SidebarPanel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;

  // Editor state
  cursorPosition: CursorPosition | null;

  // Dialogs
  showQuickOpen: boolean;
  showGoToLine: boolean;

  // Actions
  setProjectContext: (context: IdeProjectContext) => void;
  setActivePanel: (panel: SidebarPanel) => void;
  togglePanel: (panel: Exclude<SidebarPanel, null>) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setCursorPosition: (position: CursorPosition | null) => void;
  setShowQuickOpen: (show: boolean) => void;
  setShowGoToLine: (show: boolean) => void;
}

export const useIdeStore = create<IdeState>((set, get) => ({
  // Initial state
  projectContext: null,
  activePanel: "files",
  sidebarWidth: 260,
  sidebarCollapsed: false,
  cursorPosition: null,
  showQuickOpen: false,
  showGoToLine: false,

  // Actions
  setProjectContext: (context) => set({ projectContext: context }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) => {
    const { activePanel } = get();
    if (activePanel === panel) {
      set({ activePanel: null, sidebarCollapsed: true });
    } else {
      set({ activePanel: panel, sidebarCollapsed: false });
    }
  },

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  setShowQuickOpen: (show) => set({ showQuickOpen: show }),

  setShowGoToLine: (show) => set({ showGoToLine: show }),
}));
