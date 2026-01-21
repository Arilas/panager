/**
 * Plugin Events Hook
 *
 * Listens for plugin events from the Rust backend and updates stores accordingly.
 */

import { useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useProblemsStore } from "../stores/problems";
import { usePluginsStore } from "../stores/plugins";
import type { PluginEvent, DiagnosticsUpdatedPayload } from "../types/plugin";
import type { Diagnostic } from "../types/problems";

/**
 * Convert backend diagnostic format to frontend format
 * (Backend uses camelCase, which matches our frontend Diagnostic type)
 */
function convertDiagnostic(
  backendDiag: DiagnosticsUpdatedPayload["diagnostics"][0]
): Diagnostic {
  return {
    id: backendDiag.id,
    filePath: backendDiag.filePath,
    severity: backendDiag.severity,
    message: backendDiag.message,
    source: backendDiag.source,
    code: backendDiag.code,
    startLine: backendDiag.startLine,
    startColumn: backendDiag.startColumn,
    endLine: backendDiag.endLine,
    endColumn: backendDiag.endColumn,
  };
}

export function usePluginEvents() {
  const setDiagnostics = useProblemsStore((s) => s.setDiagnostics);
  const clearDiagnostics = useProblemsStore((s) => s.clearDiagnostics);
  const updateStatusBarItem = usePluginsStore((s) => s.updateStatusBarItem);
  const removeStatusBarItem = usePluginsStore((s) => s.removeStatusBarItem);
  const updatePluginState = usePluginsStore((s) => s.updatePluginState);

  // Handle plugin events
  const handlePluginEvent = useCallback(
    (event: PluginEvent) => {
      console.log("[PluginEvents] Received event:", event.type, event);

      switch (event.type) {
        case "diagnosticsUpdated": {
          const diagnostics = event.diagnostics.map(convertDiagnostic);
          console.log("[PluginEvents] Setting diagnostics for", event.file_path, ":", diagnostics.length, "items");
          setDiagnostics(event.file_path, diagnostics);
          break;
        }

        case "diagnosticsCleared": {
          clearDiagnostics(event.plugin_id, event.file_path);
          break;
        }

        case "statusBarUpdated": {
          updateStatusBarItem({
            id: event.item.id,
            text: event.item.text,
            tooltip: event.item.tooltip,
            alignment: event.item.alignment,
            priority: event.item.priority,
          });
          break;
        }

        case "statusBarRemoved": {
          removeStatusBarItem(event.item_id);
          break;
        }

        case "pluginStateChanged": {
          updatePluginState(event.plugin_id, event.state, event.error);
          break;
        }

        default:
          console.warn("[PluginEvents] Unknown event type:", (event as { type: string }).type);
      }
    },
    [
      setDiagnostics,
      clearDiagnostics,
      updateStatusBarItem,
      removeStatusBarItem,
      updatePluginState,
    ]
  );

  // Listen for plugin events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      try {
        unlisten = await listen<PluginEvent>("plugin-event", (event) => {
          handlePluginEvent(event.payload);
        });
      } catch (error) {
        console.error("Failed to listen for plugin events:", error);
      }
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handlePluginEvent]);
}
