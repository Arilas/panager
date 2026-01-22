/**
 * Tab Store - Unified tab management with groups support
 *
 * Features:
 * - Tab groups for split view support
 * - Resolver-based tab handling
 * - SQLite database persistence
 * - Unified openTab() API
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  TabEntry,
  TabGroup,
  OpenTabOptions,
  ResolvedTabState,
  TabResolver,
} from "../lib/tabs/types";
import { TabResolverRegistry } from "../lib/tabs/registry";
import * as tabsApi from "../lib/tauri-tabs";
import type { DbTab } from "../lib/tauri-tabs";

// ============================================================
// Types
// ============================================================

/** Store initialization status */
export type TabsInitStatus = "idle" | "loading" | "ready" | "error";

/** Tab store state */
interface TabsState {
  // Initialization
  initStatus: TabsInitStatus;
  initError: string | null;
  projectPath: string | null;

  // Registry (set during init)
  registry: TabResolverRegistry | null;

  // Groups
  groups: TabGroup[];
  activeGroupId: string;

  // === INITIALIZATION ===
  /**
   * Initialize the store with project path and resolver registry.
   * Loads tabs from database.
   */
  initialize: (projectPath: string, registry: TabResolverRegistry) => Promise<void>;

  // === GROUP ACTIONS ===
  createGroup: () => Promise<string>;
  closeGroup: (groupId: string) => Promise<void>;
  setActiveGroup: (groupId: string) => void;
  moveTabToGroup: (url: string, fromGroupId: string, toGroupId: string) => Promise<void>;

  // === TAB ACTIONS ===
  openTab: (options: OpenTabOptions) => Promise<void>;
  closeTab: (url: string, groupId?: string) => Promise<void>;
  closeOtherTabs: (url: string, groupId?: string) => Promise<void>;
  closeAllTabs: (groupId?: string) => Promise<void>;
  setActiveTab: (url: string, groupId?: string) => void;
  pinTab: (url: string, groupId?: string) => Promise<void>;
  unpinTab: (url: string, groupId?: string) => Promise<void>;
  reorderTabs: (fromIndex: number, toIndex: number, groupId?: string) => Promise<void>;
  convertPreviewToPermanent: (url: string, groupId?: string) => Promise<void>;

  // === RESOLUTION ===
  resolveTab: (url: string, groupId?: string) => Promise<void>;

  // === CONTENT UPDATES ===
  updateContent: (url: string, content: string) => void;
  markSaved: (url: string) => void;
  reloadContent: (url: string) => Promise<void>;

  // === SESSION PERSISTENCE ===
  updateCursorPosition: (url: string, position: { line: number; column: number }) => void;
  updateScrollPosition: (url: string, position: { top: number; left: number }) => void;
  persistSession: (url: string, groupId?: string) => Promise<void>;

  // === URL UPDATES ===
  updateTabUrl: (oldUrl: string, newUrl: string, groupId?: string) => Promise<void>;

  // === HELPERS ===
  getActiveGroup: () => TabGroup | null;
  getActiveTab: () => TabEntry | null;
  /**
   * Get the file path of the active tab if it's a file-based tab.
   * Uses the registry to extract path from URL.
   * Returns null if no active tab or not a file tab.
   */
  getActiveFilePath: () => string | null;
  findTabInGroup: (url: string, groupId: string) => TabEntry | null;
  findTabInAnyGroup: (url: string) => { group: TabGroup; tab: TabEntry } | null;
  getTabsWithUrl: (url: string) => TabEntry[];
  isDirty: (url: string) => boolean;
  hasUnsavedChanges: () => boolean;
  getResolver: (url: string) => TabResolver | null;
}

// ============================================================
// Helpers
// ============================================================

function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyGroup(id: string): TabGroup {
  return {
    id,
    tabs: [],
    activeUrl: null,
  };
}

/** Convert DB tab to TabEntry */
function dbTabToEntry(dbTab: DbTab): TabEntry {
  return {
    url: dbTab.url,
    type: dbTab.type,
    displayName: dbTab.displayName,
    isPreview: dbTab.isPreview,
    isPinned: dbTab.isPinned,
    isDirty: false,
    resolved: null,
    cursorPosition: dbTab.cursorLine !== null && dbTab.cursorColumn !== null
      ? { line: dbTab.cursorLine, column: dbTab.cursorColumn }
      : undefined,
    scrollPosition: dbTab.scrollTop !== null && dbTab.scrollLeft !== null
      ? { top: dbTab.scrollTop, left: dbTab.scrollLeft }
      : undefined,
    selections: dbTab.selections ? JSON.parse(dbTab.selections) : undefined,
    foldedRegions: dbTab.foldedRegions ? JSON.parse(dbTab.foldedRegions) : undefined,
  };
}

/** Convert TabEntry to DB tab format */
function entryToDbTab(entry: TabEntry, groupId: string, position: number): DbTab {
  return {
    id: null,
    groupId,
    url: entry.url,
    type: entry.type,
    displayName: entry.displayName,
    position,
    isPinned: entry.isPinned,
    isActive: false, // Set separately
    isPreview: entry.isPreview,
    cursorLine: entry.cursorPosition?.line ?? null,
    cursorColumn: entry.cursorPosition?.column ?? null,
    scrollTop: entry.scrollPosition?.top ?? null,
    scrollLeft: entry.scrollPosition?.left ?? null,
    selections: entry.selections ? JSON.stringify(entry.selections) : null,
    foldedRegions: entry.foldedRegions ? JSON.stringify(entry.foldedRegions) : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================================
// Debouncing for database persistence
// ============================================================

const persistDebounceMap = new Map<string, number>();
const PERSIST_DEBOUNCE_MS = 500;

function debouncedPersist(
  key: string,
  fn: () => Promise<void>
): void {
  const existing = persistDebounceMap.get(key);
  if (existing) clearTimeout(existing);

  const timeout = window.setTimeout(() => {
    persistDebounceMap.delete(key);
    fn().catch(console.error);
  }, PERSIST_DEBOUNCE_MS);

  persistDebounceMap.set(key, timeout);
}

// ============================================================
// Store Implementation
// ============================================================

export const useTabsStore = create<TabsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    initStatus: "idle",
    initError: null,
    projectPath: null,
    registry: null,
    groups: [],
    activeGroupId: "",

    // === INITIALIZATION ===

    initialize: async (projectPath, registry) => {
      set({ initStatus: "loading", projectPath, registry });

      try {
        // Load groups from database
        const dbGroups = await tabsApi.getTabGroups(projectPath);

        if (dbGroups.length === 0) {
          // Create initial group
          const groupId = generateGroupId();
          await tabsApi.createTabGroup(projectPath, groupId);

          set({
            initStatus: "ready",
            groups: [createEmptyGroup(groupId)],
            activeGroupId: groupId,
          });
          return;
        }

        // Load tabs for each group
        const groups: TabGroup[] = [];
        let activeGroupId = "";

        for (const dbGroup of dbGroups) {
          const dbTabs = await tabsApi.getTabs(projectPath, dbGroup.id);
          const tabs = dbTabs.map(dbTabToEntry);

          // Find active tab in this group
          const activeDbTab = dbTabs.find((t) => t.isActive);

          groups.push({
            id: dbGroup.id,
            tabs,
            activeUrl: activeDbTab?.url ?? null,
          });

          if (dbGroup.isActive) {
            activeGroupId = dbGroup.id;
          }
        }

        // Ensure we have an active group
        if (!activeGroupId && groups.length > 0) {
          activeGroupId = groups[0].id;
        }

        set({
          initStatus: "ready",
          groups,
          activeGroupId,
        });
      } catch (error) {
        console.error("Failed to initialize tabs store:", error);
        set({
          initStatus: "error",
          initError: error instanceof Error ? error.message : String(error),
        });
      }
    },

    // === GROUP ACTIONS ===

    createGroup: async () => {
      const { projectPath } = get();
      if (!projectPath) throw new Error("Store not initialized");

      const groupId = generateGroupId();
      await tabsApi.createTabGroup(projectPath, groupId);

      set((state) => ({
        groups: [...state.groups, createEmptyGroup(groupId)],
        activeGroupId: groupId,
      }));

      return groupId;
    },

    closeGroup: async (groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      // Don't close the last group
      if (groups.length <= 1) return;

      await tabsApi.deleteTabGroup(projectPath, groupId);

      set((state) => {
        const newGroups = state.groups.filter((g) => g.id !== groupId);
        let newActiveGroupId = state.activeGroupId;

        if (activeGroupId === groupId) {
          // Find next group to activate
          const closedIndex = groups.findIndex((g) => g.id === groupId);
          newActiveGroupId = newGroups[Math.min(closedIndex, newGroups.length - 1)]?.id ?? "";
        }

        return {
          groups: newGroups,
          activeGroupId: newActiveGroupId,
        };
      });
    },

    setActiveGroup: (groupId) => {
      const { projectPath } = get();
      if (!projectPath) return;

      set({ activeGroupId: groupId });

      // Persist to database
      tabsApi.setActiveGroup(projectPath, groupId).catch(console.error);
    },

    moveTabToGroup: async (url, fromGroupId, toGroupId) => {
      const { projectPath } = get();
      if (!projectPath) return;

      await tabsApi.moveTabToGroup(projectPath, url, fromGroupId, toGroupId);

      set((state) => {
        const fromGroup = state.groups.find((g) => g.id === fromGroupId);
        const toGroup = state.groups.find((g) => g.id === toGroupId);
        if (!fromGroup || !toGroup) return state;

        const tabIndex = fromGroup.tabs.findIndex((t) => t.url === url);
        if (tabIndex === -1) return state;

        const [tab] = fromGroup.tabs.splice(tabIndex, 1);
        toGroup.tabs.push(tab);

        // Update active URL in source group if needed
        if (fromGroup.activeUrl === url) {
          fromGroup.activeUrl = fromGroup.tabs[0]?.url ?? null;
        }

        return { groups: [...state.groups] };
      });
    },

    // === TAB ACTIONS ===

    openTab: async (options) => {
      const { projectPath, registry, activeGroupId } = get();
      if (!projectPath || !registry) {
        throw new Error("Store not initialized");
      }

      const {
        url,
        isPreview = true,
        autoFocus = true,
        cursorPosition,
        groupId = activeGroupId,
      } = options;

      // Find resolver for this URL
      const resolver = registry.findResolver(url);
      if (!resolver) {
        throw new Error(`No resolver found for URL: ${url}`);
      }

      // Find target group - get fresh state to handle recently created groups
      const groups = get().groups;
      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // Check if tab already exists in this group
      const existingTab = group.tabs.find((t) => t.url === url);
      if (existingTab) {
        // Focus existing tab
        if (autoFocus) {
          get().setActiveTab(url, groupId);
        }
        // Update cursor position if provided
        if (cursorPosition) {
          get().updateCursorPosition(url, cursorPosition);
        }
        return;
      }

      // Create new tab entry
      const newTab: TabEntry = {
        url,
        type: resolver.id,
        displayName: resolver.getDisplayName(url),
        isPreview,
        isPinned: false,
        isDirty: false,
        resolved: null,
        cursorPosition,
      };

      // Handle preview tab replacement
      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === groupId);
        if (!targetGroup) return state;

        let newTabs = [...targetGroup.tabs];

        if (isPreview) {
          // Find and replace existing preview tab
          const previewIndex = newTabs.findIndex((t) => t.isPreview && !t.isPinned);
          if (previewIndex !== -1) {
            newTabs[previewIndex] = newTab;
          } else {
            newTabs.push(newTab);
          }
        } else {
          newTabs.push(newTab);
        }

        // Update group
        const newGroups = state.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                tabs: newTabs,
                activeUrl: autoFocus ? url : g.activeUrl,
              }
            : g
        );

        return { groups: newGroups };
      });

      // Persist to database
      const dbTab = entryToDbTab(newTab, groupId, group.tabs.length);
      dbTab.isActive = autoFocus;
      await tabsApi.saveTab(projectPath, dbTab);

      if (autoFocus) {
        await tabsApi.setActiveTab(projectPath, groupId, url);
      }

      // Auto-resolve if focused
      if (autoFocus) {
        get().resolveTab(url, groupId).catch(console.error);
      }
    },

    closeTab: async (url, groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      if (!group) return;

      const tabIndex = group.tabs.findIndex((t) => t.url === url);
      if (tabIndex === -1) return;

      // Delete from database
      await tabsApi.deleteTab(projectPath, targetGroupId, url);

      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === targetGroupId);
        if (!targetGroup) return state;

        const newTabs = targetGroup.tabs.filter((t) => t.url !== url);

        // Determine new active tab
        let newActiveUrl = targetGroup.activeUrl;
        if (targetGroup.activeUrl === url) {
          if (newTabs.length > 0) {
            newActiveUrl = newTabs[Math.min(tabIndex, newTabs.length - 1)].url;
          } else {
            newActiveUrl = null;
          }
        }

        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId
            ? { ...g, tabs: newTabs, activeUrl: newActiveUrl }
            : g
        );

        return { groups: newGroups };
      });
    },

    closeOtherTabs: async (url, groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      if (!group) return;

      // Close all tabs except pinned and the specified one
      const tabsToClose = group.tabs.filter((t) => t.url !== url && !t.isPinned);

      for (const tab of tabsToClose) {
        await tabsApi.deleteTab(projectPath, targetGroupId, tab.url);
      }

      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === targetGroupId);
        if (!targetGroup) return state;

        const newTabs = targetGroup.tabs.filter((t) => t.url === url || t.isPinned);

        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId
            ? { ...g, tabs: newTabs, activeUrl: url }
            : g
        );

        return { groups: newGroups };
      });
    },

    closeAllTabs: async (groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      if (!group) return;

      // Close all non-pinned tabs
      const tabsToClose = group.tabs.filter((t) => !t.isPinned);

      for (const tab of tabsToClose) {
        await tabsApi.deleteTab(projectPath, targetGroupId, tab.url);
      }

      // Check if group will be empty and there are other groups
      const remainingTabs = group.tabs.filter((t) => t.isPinned);
      const shouldCloseGroup = remainingTabs.length === 0 && groups.length > 1;

      if (shouldCloseGroup) {
        // Close the entire group
        await get().closeGroup(targetGroupId);
      } else {
        set((state) => {
          const targetGroup = state.groups.find((g) => g.id === targetGroupId);
          if (!targetGroup) return state;

          const newTabs = targetGroup.tabs.filter((t) => t.isPinned);
          const newActiveUrl = newTabs[0]?.url ?? null;

          const newGroups = state.groups.map((g) =>
            g.id === targetGroupId
              ? { ...g, tabs: newTabs, activeUrl: newActiveUrl }
              : g
          );

          return { groups: newGroups };
        });
      }
    },

    setActiveTab: (url, groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;

      set((state) => {
        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId ? { ...g, activeUrl: url } : g
        );
        return { groups: newGroups };
      });

      // Persist and resolve
      tabsApi.setActiveTab(projectPath, targetGroupId, url).catch(console.error);

      // Resolve if not already resolved
      const group = groups.find((g) => g.id === targetGroupId);
      const tab = group?.tabs.find((t) => t.url === url);
      if (tab && !tab.resolved && !tab.error) {
        get().resolveTab(url, targetGroupId).catch(console.error);
      }
    },

    pinTab: async (url, groupId) => {
      const { projectPath, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;

      await tabsApi.setTabPinned(projectPath, targetGroupId, url, true);

      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === targetGroupId);
        if (!targetGroup) return state;

        // Find and update the tab
        const tabIndex = targetGroup.tabs.findIndex((t) => t.url === url);
        if (tabIndex === -1) return state;

        const tab = targetGroup.tabs[tabIndex];
        const updatedTab = { ...tab, isPinned: true, isPreview: false };

        // Move to pinned section (before first non-pinned)
        const newTabs = targetGroup.tabs.filter((t) => t.url !== url);
        const insertIndex = newTabs.findIndex((t) => !t.isPinned);
        newTabs.splice(insertIndex === -1 ? newTabs.length : insertIndex, 0, updatedTab);

        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId ? { ...g, tabs: newTabs } : g
        );

        return { groups: newGroups };
      });
    },

    unpinTab: async (url, groupId) => {
      const { projectPath, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;

      await tabsApi.setTabPinned(projectPath, targetGroupId, url, false);

      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === targetGroupId);
        if (!targetGroup) return state;

        const tabIndex = targetGroup.tabs.findIndex((t) => t.url === url);
        if (tabIndex === -1) return state;

        const tab = targetGroup.tabs[tabIndex];
        const updatedTab = { ...tab, isPinned: false };

        // Move after last pinned tab
        const newTabs = targetGroup.tabs.filter((t) => t.url !== url);
        // Find last pinned index (or -1 if none)
        let lastPinnedIndex = -1;
        for (let i = newTabs.length - 1; i >= 0; i--) {
          if (newTabs[i].isPinned) {
            lastPinnedIndex = i;
            break;
          }
        }
        newTabs.splice(lastPinnedIndex + 1, 0, updatedTab);

        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId ? { ...g, tabs: newTabs } : g
        );

        return { groups: newGroups };
      });
    },

    reorderTabs: async (fromIndex, toIndex, groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      if (!group) return;

      // Don't move unpinned tabs before pinned tabs
      const pinnedCount = group.tabs.filter((t) => t.isPinned).length;
      const isMovingPinned = group.tabs[fromIndex]?.isPinned;

      let adjustedToIndex = toIndex;
      if (!isMovingPinned && adjustedToIndex < pinnedCount) {
        adjustedToIndex = pinnedCount;
      }
      if (isMovingPinned && adjustedToIndex >= pinnedCount) {
        adjustedToIndex = pinnedCount - 1;
      }

      set((state) => {
        const targetGroup = state.groups.find((g) => g.id === targetGroupId);
        if (!targetGroup) return state;

        const newTabs = [...targetGroup.tabs];
        const [removed] = newTabs.splice(fromIndex, 1);
        newTabs.splice(adjustedToIndex, 0, removed);

        const newGroups = state.groups.map((g) =>
          g.id === targetGroupId ? { ...g, tabs: newTabs } : g
        );

        return { groups: newGroups };
      });

      // Persist new order
      const updatedGroup = get().groups.find((g) => g.id === targetGroupId);
      if (updatedGroup) {
        const urls = updatedGroup.tabs.map((t) => t.url);
        await tabsApi.reorderTabs(projectPath, targetGroupId, urls);
      }
    },

    convertPreviewToPermanent: async (url, groupId) => {
      const { projectPath, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;

      await tabsApi.convertPreviewToPermanent(projectPath, targetGroupId, url);

      set((state) => {
        const newGroups = state.groups.map((g) => {
          if (g.id !== targetGroupId) return g;

          return {
            ...g,
            tabs: g.tabs.map((t) =>
              t.url === url ? { ...t, isPreview: false } : t
            ),
          };
        });

        return { groups: newGroups };
      });
    },

    // === RESOLUTION ===

    resolveTab: async (url, groupId) => {
      const { registry, groups, activeGroupId } = get();
      if (!registry) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      const tab = group?.tabs.find((t) => t.url === url);

      if (!tab || tab.resolved) return;

      const resolver = registry.findResolver(url);
      if (!resolver) {
        // Mark as error
        set((state) => {
          const newGroups = state.groups.map((g) => {
            if (g.id !== targetGroupId) return g;
            return {
              ...g,
              tabs: g.tabs.map((t) =>
                t.url === url ? { ...t, error: "No resolver found" } : t
              ),
            };
          });
          return { groups: newGroups };
        });
        return;
      }

      try {
        const resolved = await resolver.resolve(url);

        // Check if URL changed (e.g., chat://new -> chat://session-id)
        if (resolved.url !== url) {
          await get().updateTabUrl(url, resolved.url, targetGroupId);
        }

        set((state) => {
          const newGroups = state.groups.map((g) => {
            if (g.id !== targetGroupId) return g;
            return {
              ...g,
              tabs: g.tabs.map((t) =>
                t.url === url || t.url === resolved.url
                  ? { ...t, url: resolved.url, resolved, error: undefined }
                  : t
              ),
              activeUrl: g.activeUrl === url ? resolved.url : g.activeUrl,
            };
          });
          return { groups: newGroups };
        });
      } catch (error) {
        // Mark as error
        set((state) => {
          const newGroups = state.groups.map((g) => {
            if (g.id !== targetGroupId) return g;
            return {
              ...g,
              tabs: g.tabs.map((t) =>
                t.url === url
                  ? { ...t, error: error instanceof Error ? error.message : String(error) }
                  : t
              ),
            };
          });
          return { groups: newGroups };
        });
      }
    },

    // === CONTENT UPDATES ===

    updateContent: (url, content) => {
      set((state) => {
        const newGroups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) => {
            if (t.url !== url || !t.resolved) return t;

            // Update content in resolved data
            const data = t.resolved.data as Record<string, unknown>;
            if ("currentContent" in data) {
              const newResolved: ResolvedTabState = {
                ...t.resolved,
                data: { ...data, currentContent: content },
              };

              // Check dirty status
              const savedContent = data.savedContent as string | undefined;
              const isDirty = savedContent !== undefined && content !== savedContent;

              // Convert preview to permanent on edit
              return {
                ...t,
                resolved: newResolved,
                isDirty,
                isPreview: isDirty ? false : t.isPreview,
              };
            }

            return t;
          }),
        }));

        return { groups: newGroups };
      });

      // Convert preview to permanent in database if dirty
      const { projectPath, groups: currentGroups } = get();
      if (projectPath) {
        for (const group of currentGroups) {
          const tab = group.tabs.find((t) => t.url === url);
          if (tab?.isPreview === false && tab.isDirty) {
            tabsApi.convertPreviewToPermanent(projectPath, group.id, url).catch(console.error);
            break;
          }
        }
      }
    },

    markSaved: (url) => {
      set((state) => {
        const newGroups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) => {
            if (t.url !== url || !t.resolved) return t;

            const data = t.resolved.data as Record<string, unknown>;
            if ("currentContent" in data && "savedContent" in data) {
              const newResolved: ResolvedTabState = {
                ...t.resolved,
                data: { ...data, savedContent: data.currentContent },
              };
              return { ...t, resolved: newResolved, isDirty: false };
            }

            return t;
          }),
        }));

        return { groups: newGroups };
      });
    },

    reloadContent: async (url) => {
      const { registry, groups } = get();
      if (!registry) return;

      // Find tab in any group
      for (const group of groups) {
        const tab = group.tabs.find((t) => t.url === url);
        if (tab) {
          const resolver = registry.findResolver(url);
          if (resolver?.onExternalChange) {
            try {
              const newResolved = await resolver.onExternalChange(url, null);
              if (newResolved) {
                set((state) => {
                  const newGroups = state.groups.map((g) => ({
                    ...g,
                    tabs: g.tabs.map((t) =>
                      t.url === url ? { ...t, resolved: newResolved, isDirty: false } : t
                    ),
                  }));
                  return { groups: newGroups };
                });
              }
            } catch (error) {
              console.error("Failed to reload content:", error);
            }
          }
          break;
        }
      }
    },

    // === SESSION PERSISTENCE ===

    updateCursorPosition: (url, position) => {
      set((state) => {
        const newGroups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.url === url ? { ...t, cursorPosition: position } : t
          ),
        }));
        return { groups: newGroups };
      });

      // Debounced persist
      const { projectPath, groups: currentGroups } = get();
      if (projectPath) {
        const group = currentGroups.find((g) => g.tabs.some((t) => t.url === url));
        if (group) {
          debouncedPersist(`cursor-${url}`, async () => {
            const tab = get().groups.find((g) => g.id === group.id)?.tabs.find((t) => t.url === url);
            if (tab) {
              await tabsApi.updateTabSession(projectPath, group.id, url, {
                cursorLine: tab.cursorPosition?.line ?? null,
                cursorColumn: tab.cursorPosition?.column ?? null,
                scrollTop: tab.scrollPosition?.top ?? null,
                scrollLeft: tab.scrollPosition?.left ?? null,
                selections: tab.selections ? JSON.stringify(tab.selections) : null,
                foldedRegions: tab.foldedRegions ? JSON.stringify(tab.foldedRegions) : null,
              });
            }
          });
        }
      }
    },

    updateScrollPosition: (url, position) => {
      set((state) => {
        const newGroups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.url === url ? { ...t, scrollPosition: position } : t
          ),
        }));
        return { groups: newGroups };
      });

      // Debounced persist
      const { projectPath, groups } = get();
      if (projectPath) {
        const group = groups.find((g) => g.tabs.some((t) => t.url === url));
        if (group) {
          debouncedPersist(`scroll-${url}`, async () => {
            const tab = get().groups.find((g) => g.id === group.id)?.tabs.find((t) => t.url === url);
            if (tab) {
              await tabsApi.updateTabSession(projectPath, group.id, url, {
                cursorLine: tab.cursorPosition?.line ?? null,
                cursorColumn: tab.cursorPosition?.column ?? null,
                scrollTop: tab.scrollPosition?.top ?? null,
                scrollLeft: tab.scrollPosition?.left ?? null,
                selections: tab.selections ? JSON.stringify(tab.selections) : null,
                foldedRegions: tab.foldedRegions ? JSON.stringify(tab.foldedRegions) : null,
              });
            }
          });
        }
      }
    },

    persistSession: async (url, groupId) => {
      const { projectPath, groups, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;
      const group = groups.find((g) => g.id === targetGroupId);
      const tab = group?.tabs.find((t) => t.url === url);

      if (!tab) return;

      await tabsApi.updateTabSession(projectPath, targetGroupId, url, {
        cursorLine: tab.cursorPosition?.line ?? null,
        cursorColumn: tab.cursorPosition?.column ?? null,
        scrollTop: tab.scrollPosition?.top ?? null,
        scrollLeft: tab.scrollPosition?.left ?? null,
        selections: tab.selections ? JSON.stringify(tab.selections) : null,
        foldedRegions: tab.foldedRegions ? JSON.stringify(tab.foldedRegions) : null,
      });
    },

    // === URL UPDATES ===

    updateTabUrl: async (oldUrl, newUrl, groupId) => {
      const { projectPath, activeGroupId } = get();
      if (!projectPath) return;

      const targetGroupId = groupId ?? activeGroupId;

      await tabsApi.updateTabUrl(projectPath, targetGroupId, oldUrl, newUrl);

      set((state) => {
        const newGroups = state.groups.map((g) => {
          if (g.id !== targetGroupId) return g;
          return {
            ...g,
            tabs: g.tabs.map((t) => (t.url === oldUrl ? { ...t, url: newUrl } : t)),
            activeUrl: g.activeUrl === oldUrl ? newUrl : g.activeUrl,
          };
        });
        return { groups: newGroups };
      });
    },

    // === HELPERS ===

    getActiveGroup: () => {
      const { groups, activeGroupId } = get();
      return groups.find((g) => g.id === activeGroupId) ?? null;
    },

    getActiveTab: () => {
      const group = get().getActiveGroup();
      if (!group || !group.activeUrl) return null;
      return group.tabs.find((t) => t.url === group.activeUrl) ?? null;
    },

    getActiveFilePath: () => {
      const { registry } = get();
      const tab = get().getActiveTab();
      if (!tab || !registry) return null;

      // Use the resolver to get the file path from the URL
      const resolver = registry.findResolver(tab.url);
      if (!resolver) return null;

      // Check if this resolver handles file-based tabs
      // File resolvers typically use file:// URLs
      if (!tab.url.startsWith("file://")) return null;

      // Extract the path from the URL
      try {
        // file:// URLs encode the path
        return decodeURIComponent(tab.url.slice("file://".length));
      } catch {
        return null;
      }
    },

    findTabInGroup: (url, groupId) => {
      const { groups } = get();
      const group = groups.find((g) => g.id === groupId);
      return group?.tabs.find((t) => t.url === url) ?? null;
    },

    findTabInAnyGroup: (url) => {
      const { groups } = get();
      for (const group of groups) {
        const tab = group.tabs.find((t) => t.url === url);
        if (tab) {
          return { group, tab };
        }
      }
      return null;
    },

    getTabsWithUrl: (url) => {
      const { groups } = get();
      const tabs: TabEntry[] = [];
      for (const group of groups) {
        const tab = group.tabs.find((t) => t.url === url);
        if (tab) tabs.push(tab);
      }
      return tabs;
    },

    isDirty: (url) => {
      const { groups } = get();
      for (const group of groups) {
        const tab = group.tabs.find((t) => t.url === url);
        if (tab) return tab.isDirty;
      }
      return false;
    },

    hasUnsavedChanges: () => {
      const { groups } = get();
      for (const group of groups) {
        for (const tab of group.tabs) {
          if (tab.isDirty) return true;
        }
      }
      return false;
    },

    getResolver: (url) => {
      const { registry } = get();
      return registry?.findResolver(url) ?? null;
    },
  }))
);

// ============================================================
// Selector Hooks
// ============================================================

/** Get active tab entry */
export function useActiveTab() {
  return useTabsStore((s) => s.getActiveTab());
}

/** Get active group */
export function useActiveGroup() {
  return useTabsStore((s) => s.getActiveGroup());
}

/** Get all groups */
export function useGroups() {
  return useTabsStore((s) => s.groups);
}

/** Check if store is ready */
export function useTabsReady() {
  return useTabsStore((s) => s.initStatus === "ready");
}
