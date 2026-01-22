/**
 * Tab Management Tauri API
 *
 * TypeScript bindings for the tab and tab group database operations.
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================
// Types
// ============================================================

/** Tab group stored in database */
export interface DbTabGroup {
  id: string;
  position: number;
  isActive: boolean;
  createdAt: number;
}

/** Tab stored in database */
export interface DbTab {
  id: number | null;
  groupId: string;
  url: string;
  type: string; // Resolver ID
  displayName: string;
  position: number;
  isPinned: boolean;
  isActive: boolean;
  isPreview: boolean;

  // Session data
  cursorLine: number | null;
  cursorColumn: number | null;
  scrollTop: number | null;
  scrollLeft: number | null;
  selections: string | null; // JSON
  foldedRegions: string | null; // JSON

  createdAt: number;
  updatedAt: number;
}

/** Tab session data for updates */
export interface DbTabSession {
  cursorLine: number | null;
  cursorColumn: number | null;
  scrollTop: number | null;
  scrollLeft: number | null;
  selections: string | null;
  foldedRegions: string | null;
}

// ============================================================
// Tab Group Operations
// ============================================================

/**
 * Get all tab groups for a project
 */
export async function getTabGroups(projectPath: string): Promise<DbTabGroup[]> {
  return invoke("ide_get_tab_groups", { projectPath });
}

/**
 * Create a new tab group
 */
export async function createTabGroup(
  projectPath: string,
  groupId: string
): Promise<DbTabGroup> {
  return invoke("ide_create_tab_group", { projectPath, groupId });
}

/**
 * Delete a tab group (cascades to tabs)
 */
export async function deleteTabGroup(
  projectPath: string,
  groupId: string
): Promise<void> {
  return invoke("ide_delete_tab_group", { projectPath, groupId });
}

/**
 * Set the active tab group
 */
export async function setActiveGroup(
  projectPath: string,
  groupId: string
): Promise<void> {
  return invoke("ide_set_active_group", { projectPath, groupId });
}

/**
 * Reorder tab groups
 */
export async function reorderGroups(
  projectPath: string,
  groupIds: string[]
): Promise<void> {
  return invoke("ide_reorder_groups", { projectPath, groupIds });
}

// ============================================================
// Tab Operations
// ============================================================

/**
 * Get all tabs for a specific group
 */
export async function getTabs(
  projectPath: string,
  groupId: string
): Promise<DbTab[]> {
  return invoke("ide_get_tabs", { projectPath, groupId });
}

/**
 * Get all tabs across all groups
 */
export async function getAllTabs(projectPath: string): Promise<DbTab[]> {
  return invoke("ide_get_all_tabs", { projectPath });
}

/**
 * Save a tab (insert or update)
 */
export async function saveTab(projectPath: string, tab: DbTab): Promise<number> {
  return invoke("ide_save_tab", { projectPath, tab });
}

/**
 * Update a tab's URL (e.g., chat://new -> chat://session-id)
 */
export async function updateTabUrl(
  projectPath: string,
  groupId: string,
  oldUrl: string,
  newUrl: string
): Promise<void> {
  return invoke("ide_update_tab_url", { projectPath, groupId, oldUrl, newUrl });
}

/**
 * Delete a tab
 */
export async function deleteTab(
  projectPath: string,
  groupId: string,
  url: string
): Promise<void> {
  return invoke("ide_delete_tab", { projectPath, groupId, url });
}

/**
 * Set the active tab within a group
 */
export async function setActiveTab(
  projectPath: string,
  groupId: string,
  url: string
): Promise<void> {
  return invoke("ide_set_active_tab", { projectPath, groupId, url });
}

/**
 * Reorder tabs within a group
 */
export async function reorderTabs(
  projectPath: string,
  groupId: string,
  urls: string[]
): Promise<void> {
  return invoke("ide_reorder_tabs", { projectPath, groupId, urls });
}

/**
 * Move a tab to a different group
 */
export async function moveTabToGroup(
  projectPath: string,
  url: string,
  fromGroup: string,
  toGroup: string
): Promise<void> {
  return invoke("ide_move_tab_to_group", { projectPath, url, fromGroup, toGroup });
}

/**
 * Update tab session data (cursor, scroll, etc.)
 */
export async function updateTabSession(
  projectPath: string,
  groupId: string,
  url: string,
  session: DbTabSession
): Promise<void> {
  return invoke("ide_update_tab_session", { projectPath, groupId, url, session });
}

/**
 * Pin or unpin a tab
 */
export async function setTabPinned(
  projectPath: string,
  groupId: string,
  url: string,
  pinned: boolean
): Promise<void> {
  return invoke("ide_set_tab_pinned", { projectPath, groupId, url, pinned });
}

/**
 * Convert a preview tab to a permanent tab
 */
export async function convertPreviewToPermanent(
  projectPath: string,
  groupId: string,
  url: string
): Promise<void> {
  return invoke("ide_convert_preview_to_permanent", { projectPath, groupId, url });
}

/**
 * Delete all preview tabs in a group
 */
export async function deletePreviewTabs(
  projectPath: string,
  groupId: string
): Promise<void> {
  return invoke("ide_delete_preview_tabs", { projectPath, groupId });
}

/**
 * Clear all tabs and groups (for testing or reset)
 */
export async function clearAllTabs(projectPath: string): Promise<void> {
  return invoke("ide_clear_all_tabs", { projectPath });
}
