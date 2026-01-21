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
import type { RightSidebarPanel } from "../types/acp";

interface IdeState {
  // Project context
  projectContext: IdeProjectContext | null;

  // UI state - Left sidebar
  activePanel: SidebarPanel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;

  // UI state - Right sidebar
  rightSidebarPanel: RightSidebarPanel;
  rightSidebarWidth: number;
  rightSidebarCollapsed: boolean;

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
  showGoToSymbol: boolean;
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
  setShowGoToSymbol: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;

  // Bottom panel actions
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setBottomPanelHeight: (height: number) => void;
  openBottomPanelTab: (tab: BottomPanelTab) => void;

  // Right sidebar actions
  setRightSidebarPanel: (panel: RightSidebarPanel) => void;
  toggleRightSidebarPanel: (panel: Exclude<RightSidebarPanel, null>) => void;
  setRightSidebarWidth: (width: number) => void;
  toggleRightSidebar: () => void;

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
  rightSidebarPanel: null,
  rightSidebarWidth: 320,
  rightSidebarCollapsed: true,
  bottomPanelOpen: false,
  bottomPanelTab: "problems",
  bottomPanelHeight: 200,
  cursorPosition: null,
  gitBlameEnabled: true,
  showQuickOpen: false,
  showGoToLine: false,
  showGoToSymbol: false,
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

  setShowGoToSymbol: (show) => set({ showGoToSymbol: show }),

  setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),

  // Bottom panel actions
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

  toggleBottomPanel: () =>
    set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),

  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  openBottomPanelTab: (tab) => set({ bottomPanelOpen: true, bottomPanelTab: tab }),

  // Right sidebar actions
  setRightSidebarPanel: (panel) => set({ rightSidebarPanel: panel }),

  toggleRightSidebarPanel: (panel) => {
    const { rightSidebarPanel } = get();
    if (rightSidebarPanel === panel) {
      set({ rightSidebarPanel: null, rightSidebarCollapsed: true });
    } else {
      set({ rightSidebarPanel: panel, rightSidebarCollapsed: false });
    }
  },

  setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),

  toggleRightSidebar: () =>
    set((state) => ({ rightSidebarCollapsed: !state.rightSidebarCollapsed })),

  // Git blame actions
  setGitBlameEnabled: (enabled) => set({ gitBlameEnabled: enabled }),
  toggleGitBlame: () => set((state) => ({ gitBlameEnabled: !state.gitBlameEnabled })),
}));
