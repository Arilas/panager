/**
 * Store Subscriptions for Monaco
 *
 * Sets up subscriptions to editorStore to trigger:
 * - CodeLens refresh when blame/symbols change
 * - Decoration updates when lineDiff changes
 */

import { useEditorStore, isFileTab, type TabState } from "../stores/editor";
import { useGitStore } from "../stores/git";
import { triggerCodeLensRefresh } from "./providers/codeLens";

let subscriptionsSetup = false;
const unsubscribers: Array<() => void> = [];

// Track previous state for comparison
let prevTabStates: Record<string, TabState> = {};
let prevPreviewTab: TabState | null = null;
let prevBranchName: string | undefined = undefined;

/**
 * Set up store subscriptions for Monaco providers and decorations.
 * Should be called once during Monaco initialization.
 */
export function setupStoreSubscriptions(): void {
  if (subscriptionsSetup) return;

  console.log("[Monaco] Setting up store subscriptions");

  // Subscribe to editor store for file state changes
  unsubscribers.push(
    useEditorStore.subscribe((state) => {
      let needsRefresh = false;

      // Check permanent tabs (only file tabs have blame/symbols/lineDiff)
      for (const [path, tabState] of Object.entries(state.tabStates)) {
        if (!isFileTab(tabState)) continue;

        const prevTabState = prevTabStates[path];
        if (!prevTabState || !isFileTab(prevTabState)) {
          // New file opened
          needsRefresh = true;
          break;
        }
        if (
          tabState.blameData !== prevTabState.blameData ||
          tabState.symbols !== prevTabState.symbols ||
          tabState.lineDiff !== prevTabState.lineDiff
        ) {
          needsRefresh = true;
          break;
        }
      }

      // Check preview tab (only if it's a file tab)
      if (!needsRefresh && state.previewTab && isFileTab(state.previewTab)) {
        if (!prevPreviewTab || !isFileTab(prevPreviewTab)) {
          needsRefresh = true;
        } else {
          if (
            state.previewTab.blameData !== prevPreviewTab.blameData ||
            state.previewTab.symbols !== prevPreviewTab.symbols ||
            state.previewTab.lineDiff !== prevPreviewTab.lineDiff
          ) {
            needsRefresh = true;
          }
        }
      }

      // Check settings changes
      // Note: We don't track prev settings, but changes are rare enough
      // that triggering refresh is acceptable

      // Update previous state
      prevTabStates = state.tabStates;
      prevPreviewTab = state.previewTab;

      if (needsRefresh) {
        triggerCodeLensRefresh();
      }
    })
  );

  // Subscribe to git store branch changes to clear blame caches
  unsubscribers.push(
    useGitStore.subscribe((state) => {
      const currentBranch = state.branch?.name;
      if (
        currentBranch !== prevBranchName &&
        prevBranchName !== undefined
      ) {
        console.log("[Monaco] Branch changed, clearing blame caches");
        useEditorStore.getState().clearAllBlameCaches();
        triggerCodeLensRefresh();
      }
      prevBranchName = currentBranch;
    })
  );

  subscriptionsSetup = true;
  console.log("[Monaco] Store subscriptions configured");
}

/**
 * Clean up all subscriptions.
 * Generally not needed as subscriptions persist for the app lifetime.
 */
export function cleanupSubscriptions(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  subscriptionsSetup = false;
  prevTabStates = {};
  prevPreviewTab = null;
  prevBranchName = undefined;
}

/**
 * Check if subscriptions have been set up.
 */
export function areSubscriptionsSetup(): boolean {
  return subscriptionsSetup;
}
