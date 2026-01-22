/**
 * Navigation Store - Back/forward history for editor navigation
 *
 * Tracks:
 * - Tab switches
 * - "Go to Definition" jumps
 * - Search result navigation
 *
 * Provides back/forward navigation like a browser.
 */

import { create } from "zustand";
import { useTabsStore } from "./tabs";

// ============================================================
// Types
// ============================================================

/** Navigation entry - stores URL and position for back/forward */
export interface NavigationEntry {
  /** Tab URL */
  url: string;
  /** Group ID the tab was in */
  groupId: string;
  /** Cursor position at the time */
  position: { line: number; column: number };
}

interface NavigationState {
  /** Navigation history stack */
  history: NavigationEntry[];
  /** Current position in history (-1 = at the end/latest) */
  historyIndex: number;

  // === ACTIONS ===

  /**
   * Push a new location to history.
   * Call this when navigating to a new location (opening file, go to definition, etc.)
   */
  pushLocation: (entry: NavigationEntry) => void;

  /**
   * Navigate back in history.
   * Returns the entry to navigate to, or null if can't go back.
   */
  navigateBack: () => NavigationEntry | null;

  /**
   * Navigate forward in history.
   * Returns the entry to navigate to, or null if can't go forward.
   */
  navigateForward: () => NavigationEntry | null;

  /** Check if can navigate back */
  canNavigateBack: () => boolean;

  /** Check if can navigate forward */
  canNavigateForward: () => boolean;

  /** Clear all history */
  clearHistory: () => void;
}

// ============================================================
// Constants
// ============================================================

const MAX_HISTORY_SIZE = 50;

// ============================================================
// Store Implementation
// ============================================================

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  history: [],
  historyIndex: -1,

  pushLocation: (entry) => {
    set((state) => {
      let newHistory = [...state.history];

      // If we're not at the end of history, truncate forward history
      if (state.historyIndex >= 0 && state.historyIndex < newHistory.length - 1) {
        newHistory = newHistory.slice(0, state.historyIndex + 1);
      }

      // Don't push consecutive duplicates (same URL and position)
      const lastEntry = newHistory[newHistory.length - 1];
      const isDuplicate =
        lastEntry &&
        lastEntry.url === entry.url &&
        lastEntry.groupId === entry.groupId &&
        lastEntry.position.line === entry.position.line &&
        lastEntry.position.column === entry.position.column;

      if (!isDuplicate) {
        newHistory.push(entry);

        // Limit history size
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }
      }

      return {
        history: newHistory,
        historyIndex: -1, // Reset to end
      };
    });
  },

  navigateBack: () => {
    const state = get();
    const { history, historyIndex } = state;

    if (history.length < 2) return null;

    // Calculate current position
    const currentIndex = historyIndex === -1 ? history.length - 1 : historyIndex;

    if (currentIndex <= 0) return null;

    const newIndex = currentIndex - 1;
    const targetEntry = history[newIndex];

    // Check if tab still exists
    const tabsStore = useTabsStore.getState();
    const tabExists = tabsStore.findTabInAnyGroup(targetEntry.url) !== null;

    if (!tabExists) {
      // Tab was closed, remove from history and try again
      set((s) => ({
        history: s.history.filter((_, i) => i !== newIndex),
        historyIndex: newIndex - 1 >= 0 ? newIndex - 1 : -1,
      }));
      return get().navigateBack();
    }

    set({ historyIndex: newIndex });
    return targetEntry;
  },

  navigateForward: () => {
    const state = get();
    const { history, historyIndex } = state;

    if (historyIndex === -1 || historyIndex >= history.length - 1) {
      return null;
    }

    const newIndex = historyIndex + 1;
    const targetEntry = history[newIndex];

    // Check if tab still exists
    const tabsStore = useTabsStore.getState();
    const tabExists = tabsStore.findTabInAnyGroup(targetEntry.url) !== null;

    if (!tabExists) {
      // Tab was closed, remove from history and try again
      set((s) => ({
        history: s.history.filter((_, i) => i !== newIndex),
      }));
      return get().navigateForward();
    }

    // Set to -1 if we're back at the end
    set({ historyIndex: newIndex === history.length - 1 ? -1 : newIndex });
    return targetEntry;
  },

  canNavigateBack: () => {
    const { history, historyIndex } = get();
    const currentIndex = historyIndex === -1 ? history.length - 1 : historyIndex;
    return currentIndex > 0;
  },

  canNavigateForward: () => {
    const { history, historyIndex } = get();
    return historyIndex !== -1 && historyIndex < history.length - 1;
  },

  clearHistory: () => {
    set({ history: [], historyIndex: -1 });
  },
}));

// ============================================================
// Navigation Actions (convenience functions)
// ============================================================

/**
 * Navigate back and update tab store.
 * Call this from UI back button.
 */
export async function goBack(): Promise<void> {
  const entry = useNavigationStore.getState().navigateBack();
  if (!entry) return;

  const tabsStore = useTabsStore.getState();

  // Set active group and tab
  tabsStore.setActiveGroup(entry.groupId);
  tabsStore.setActiveTab(entry.url, entry.groupId);

  // Update cursor position
  tabsStore.updateCursorPosition(entry.url, entry.position);

  // TODO: Scroll editor to position once Monaco integration is ready
}

/**
 * Navigate forward and update tab store.
 * Call this from UI forward button.
 */
export async function goForward(): Promise<void> {
  const entry = useNavigationStore.getState().navigateForward();
  if (!entry) return;

  const tabsStore = useTabsStore.getState();

  // Set active group and tab
  tabsStore.setActiveGroup(entry.groupId);
  tabsStore.setActiveTab(entry.url, entry.groupId);

  // Update cursor position
  tabsStore.updateCursorPosition(entry.url, entry.position);

  // TODO: Scroll editor to position once Monaco integration is ready
}

/**
 * Push current location to history before navigating away.
 * Call this before opening a new tab or jumping to definition.
 */
export function pushCurrentLocation(): void {
  const tabsStore = useTabsStore.getState();
  const activeTab = tabsStore.getActiveTab();
  const activeGroup = tabsStore.getActiveGroup();

  if (!activeTab || !activeGroup) return;

  const entry: NavigationEntry = {
    url: activeTab.url,
    groupId: activeGroup.id,
    position: activeTab.cursorPosition ?? { line: 1, column: 1 },
  };

  useNavigationStore.getState().pushLocation(entry);
}

// ============================================================
// Selector Hooks
// ============================================================

export function useCanNavigateBack() {
  return useNavigationStore((s) => s.canNavigateBack());
}

export function useCanNavigateForward() {
  return useNavigationStore((s) => s.canNavigateForward());
}
