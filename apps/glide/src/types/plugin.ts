/**
 * Plugin system types
 * These types mirror the Rust plugin types for frontend display
 */

/** Plugin lifecycle state */
export type PluginState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "error";

/** Plugin metadata */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  languages: string[];
  isBuiltin: boolean;
}

/** Plugin info with current state */
export interface PluginInfo {
  manifest: PluginManifest;
  state: PluginState;
  error?: string;
}

/** Status bar item alignment */
export type StatusBarAlignment = "left" | "right";

/** Status bar item from a plugin */
export interface StatusBarItem {
  id: string;
  text: string;
  tooltip?: string;
  alignment: StatusBarAlignment;
  priority: number;
}

/** Plugin event types from backend (camelCase to match Rust serde) */
export type PluginEventType =
  | "diagnosticsUpdated"
  | "diagnosticsCleared"
  | "statusBarUpdated"
  | "statusBarRemoved"
  | "pluginStateChanged";

/**
 * Plugin event from backend
 * With serde tag="type", the type field and payload fields are at the same level
 */
export type PluginEvent =
  | ({ type: "diagnosticsUpdated" } & DiagnosticsUpdatedPayload)
  | ({ type: "diagnosticsCleared" } & DiagnosticsClearedPayload)
  | ({ type: "statusBarUpdated" } & StatusBarUpdatedPayload)
  | ({ type: "statusBarRemoved" } & StatusBarRemovedPayload)
  | ({ type: "pluginStateChanged" } & PluginStateChangedPayload);

/** DiagnosticsUpdated event payload */
export interface DiagnosticsUpdatedPayload {
  plugin_id: string;
  file_path: string;
  diagnostics: Array<{
    id: string;
    filePath: string;
    severity: "error" | "warning" | "information" | "hint";
    message: string;
    source: string;
    code?: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }>;
}

/** DiagnosticsCleared event payload */
export interface DiagnosticsClearedPayload {
  plugin_id: string;
  file_path?: string;
}

/** StatusBarUpdated event payload */
export interface StatusBarUpdatedPayload {
  plugin_id: string;
  item: {
    id: string;
    text: string;
    tooltip?: string;
    alignment: "left" | "right";
    priority: number;
  };
}

/** StatusBarRemoved event payload */
export interface StatusBarRemovedPayload {
  plugin_id: string;
  item_id: string;
}

/** PluginStateChanged event payload */
export interface PluginStateChangedPayload {
  plugin_id: string;
  state: PluginState;
  error?: string;
}
