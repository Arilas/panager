import { create } from "zustand";

interface UIState {
  rightPanelVisible: boolean;
  searchQuery: string;

  // Actions
  toggleRightPanel: () => void;
  setRightPanelVisible: (visible: boolean) => void;
  setSearchQuery: (query: string) => void;
  clearSearchQuery: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightPanelVisible: true,
  searchQuery: "",

  toggleRightPanel: () =>
    set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),

  setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  clearSearchQuery: () => set({ searchQuery: "" }),
}));
