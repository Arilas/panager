/**
 * Store Subscriptions for Monaco
 *
 * Sets up subscriptions to monacoStore to trigger:
 * - CodeLens refresh when blame/symbols change
 * - Decoration updates when lineDiff changes
 */

import { useMonacoStore, type FileData } from "../stores/monaco";
import { useGitStore } from "../stores/git";
import { triggerCodeLensRefresh } from "./providers/codeLens";

let subscriptionsSetup = false;
const unsubscribers: Array<() => void> = [];

// Track previous state for comparison
let prevFileData: Record<string, FileData> = {};
let prevBranchName: string | undefined = undefined;

/**
 * Set up store subscriptions for Monaco providers and decorations.
 * Should be called once during Monaco initialization.
 */
export function setupStoreSubscriptions(): void {
  if (subscriptionsSetup) return;

  console.log("[Monaco] Setting up store subscriptions");

  // Subscribe to monaco store for file data changes
  unsubscribers.push(
    useMonacoStore.subscribe((state) => {
      let needsRefresh = false;

      // Check file data for blame/symbols/lineDiff changes
      for (const [path, fileData] of Object.entries(state.fileData)) {
        const prevData = prevFileData[path];
        if (!prevData) {
          // New file opened
          needsRefresh = true;
          break;
        }
        if (
          fileData.blameData !== prevData.blameData ||
          fileData.symbols !== prevData.symbols ||
          fileData.lineDiff !== prevData.lineDiff
        ) {
          needsRefresh = true;
          break;
        }
      }

      // Update previous state
      prevFileData = state.fileData;

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
        useMonacoStore.getState().clearAllBlameCaches();
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
  prevFileData = {};
  prevBranchName = undefined;
}

/**
 * Check if subscriptions have been set up.
 */
export function areSubscriptionsSetup(): boolean {
  return subscriptionsSetup;
}
