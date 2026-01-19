/**
 * Main IDE state store
 */

import { create } from "zustand";
import type {
  IdeProjectContext,
  SidebarPanel,
  CursorPosition,
  BottomPanelTab,
} from "../types";

interface IdeState {
  // Project context
  projectContext: IdeProjectContext | null;

  // UI state
  activePanel: SidebarPanel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;

  // Bottom panel state
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  bottomPanelHeight: number;

  // Editor state
  cursorPosition: CursorPosition | null;

  // Git blame
  gitBlameEnabled: boolean;

  // Dialogs
  showQuickOpen: boolean;
  showGoToLine: boolean;
  showSettingsDialog: boolean;

  // Actions
  setProjectContext: (context: IdeProjectContext) => void;
  setActivePanel: (panel: SidebarPanel) => void;
  togglePanel: (panel: Exclude<SidebarPanel, null>) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setCursorPosition: (position: CursorPosition | null) => void;
  setShowQuickOpen: (show: boolean) => void;
  setShowGoToLine: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;

  // Bottom panel actions
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setBottomPanelHeight: (height: number) => void;
  openBottomPanelTab: (tab: BottomPanelTab) => void;

  // Git blame actions
  setGitBlameEnabled: (enabled: boolean) => void;
  toggleGitBlame: () => void;
}

export const useIdeStore = create<IdeState>((set, get) => ({
  // Initial state
  projectContext: null,
  activePanel: "files",
  sidebarWidth: 260,
  sidebarCollapsed: false,
  bottomPanelOpen: false,
  bottomPanelTab: "problems",
  bottomPanelHeight: 200,
  cursorPosition: null,
  gitBlameEnabled: true,
  showQuickOpen: false,
  showGoToLine: false,
  showSettingsDialog: false,

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

  setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),

  // Bottom panel actions
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

  toggleBottomPanel: () =>
    set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),

  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  openBottomPanelTab: (tab) => set({ bottomPanelOpen: true, bottomPanelTab: tab }),

  // Git blame actions
  setGitBlameEnabled: (enabled) => set({ gitBlameEnabled: enabled }),
  toggleGitBlame: () => set((state) => ({ gitBlameEnabled: !state.gitBlameEnabled })),
}));
