/**
 * Application event listener for handling backend events.
 *
 * This module sets up a centralized listener for all app events emitted
 * from the Rust backend via the event bus system.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useDiagnosticsStore } from "./diagnostics";
import { useProjectsStore } from "./projects";
import { useScopesStore } from "./scopes";
import { useSettingsStore } from "./settings";

/**
 * Event types emitted from the backend.
 * These match the AppEvent enum in src-tauri/src/events/types.rs
 */
export type AppEvent =
  | { type: "ProjectAdded"; payload: { project_id: string; scope_id: string } }
  | { type: "ProjectRemoved"; payload: { project_id: string; scope_id: string } }
  | {
      type: "ProjectMoved";
      payload: {
        project_id: string;
        old_scope_id: string;
        new_scope_id: string;
      };
    }
  | {
      type: "ProjectPathChanged";
      payload: {
        project_id: string;
        scope_id: string;
        old_path: string;
        new_path: string;
      };
    }
  | {
      type: "ProjectGitStatusChanged";
      payload: { project_id: string; scope_id: string };
    }
  | { type: "ScopeCreated"; payload: { scope_id: string } }
  | { type: "ScopeDeleted"; payload: { scope_id: string } }
  | {
      type: "ScopeDefaultFolderChanged";
      payload: {
        scope_id: string;
        old_folder: string | null;
        new_folder: string | null;
      };
    }
  | { type: "ScopeGitIdentityChanged"; payload: { scope_id: string } }
  | { type: "ScopeSshAliasChanged"; payload: { scope_id: string } }
  | {
      type: "SettingChanged";
      payload: { key: string; old_value: string; new_value: string };
    }
  | { type: "MaxFeatureToggled"; payload: { feature: string; enabled: boolean } }
  | {
      type: "FolderScanCompleted";
      payload: { scope_id: string; projects_found: string[] };
    }
  | { type: "DiagnosticsUpdated"; payload: { scope_id: string } }
  | {
      type: "DiagnosticsCleared";
      payload: { scope_id: string; rule_id: string | null };
    };

/** The event name used by the backend to forward events */
const APP_EVENT_NAME = "app-event";

/**
 * Handle an incoming app event by dispatching to the appropriate stores.
 */
function handleAppEvent(event: AppEvent): void {
  switch (event.type) {
    // Project events
    case "ProjectAdded":
    case "ProjectRemoved":
      // Refresh the project list for the affected scope
      useProjectsStore.getState().fetchProjects(event.payload.scope_id);
      break;

    case "ProjectMoved":
      // Refresh both the old and new scope's project lists
      useProjectsStore.getState().fetchProjects(event.payload.old_scope_id);
      useProjectsStore.getState().fetchProjects(event.payload.new_scope_id);
      break;

    case "ProjectPathChanged":
    case "ProjectGitStatusChanged":
      // Refresh the project list for the affected scope
      useProjectsStore.getState().fetchProjects(event.payload.scope_id);
      break;

    // Scope events
    case "ScopeCreated":
    case "ScopeDeleted":
      // Refresh the scopes list
      useScopesStore.getState().fetchScopes();
      break;

    case "ScopeDefaultFolderChanged":
    case "ScopeGitIdentityChanged":
    case "ScopeSshAliasChanged":
      // Refresh the scopes list to get updated scope data
      useScopesStore.getState().fetchScopes();
      break;

    // Settings events
    case "SettingChanged":
      // Refresh settings
      useSettingsStore.getState().fetchSettings();
      break;

    case "MaxFeatureToggled":
      // Refresh settings and diagnostics
      useSettingsStore.getState().fetchSettings();
      // Refresh all diagnostics summaries when a feature is toggled
      useDiagnosticsStore.getState().fetchAllSummaries();
      break;

    // Folder scanner events
    case "FolderScanCompleted":
      // Refresh the project list for the scanned scope
      if (event.payload.projects_found.length > 0) {
        useProjectsStore.getState().fetchProjects(event.payload.scope_id);
      }
      break;

    // Diagnostics events
    case "DiagnosticsUpdated":
      useDiagnosticsStore.getState().handleDiagnosticsUpdated(event.payload.scope_id);
      break;

    case "DiagnosticsCleared":
      useDiagnosticsStore.getState().handleDiagnosticsCleared(
        event.payload.scope_id,
        event.payload.rule_id
      );
      break;

    default: {
      // TypeScript exhaustiveness check - if this errors, add a handler for the new event type
      const _exhaustiveCheck: never = event;
      console.warn("Unhandled app event type:", (_exhaustiveCheck as AppEvent).type);
    }
  }
}

/**
 * Set up the application event listener.
 *
 * This should be called once during app initialization (e.g., in App.tsx useEffect).
 * Returns an unlisten function that should be called on cleanup.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unlisten = setupAppEventListener();
 *   return () => {
 *     unlisten.then(fn => fn());
 *   };
 * }, []);
 * ```
 */
export async function setupAppEventListener(): Promise<UnlistenFn> {
  console.log("[Events] Setting up app event listener");

  return listen<AppEvent>(APP_EVENT_NAME, (event) => {
    const appEvent = event.payload;
    console.log("[Events] Received:", appEvent.type, appEvent.payload);

    try {
      handleAppEvent(appEvent);
    } catch (error) {
      console.error("[Events] Error handling event:", error);
    }
  });
}

/**
 * Listen for a specific event type.
 *
 * This is useful for components that need to react to specific events
 * without going through the store system.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unlisten = onAppEvent("DiagnosticsUpdated", (payload) => {
 *     console.log("Diagnostics updated for scope:", payload.scope_id);
 *   });
 *   return () => {
 *     unlisten.then(fn => fn());
 *   };
 * }, []);
 * ```
 */
export async function onAppEvent<T extends AppEvent["type"]>(
  eventType: T,
  callback: (payload: Extract<AppEvent, { type: T }>["payload"]) => void
): Promise<UnlistenFn> {
  return listen<AppEvent>(APP_EVENT_NAME, (event) => {
    if (event.payload.type === eventType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(event.payload.payload as any);
    }
  });
}
