/**
 * Diagnostics Markers
 *
 * Syncs LSP diagnostics from the problems store to Monaco editor markers.
 * This displays error/warning squiggly lines in the editor.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, MarkerSeverity } from "monaco-editor";
import { useProblemsStore } from "../stores/problems";
import type { Diagnostic, DiagnosticSeverity } from "../types/problems";

const MARKER_OWNER = "lsp-diagnostics";

let monaco: Monaco | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Convert diagnostic severity to Monaco MarkerSeverity.
 */
function mapSeverity(
  monacoInstance: Monaco,
  severity: DiagnosticSeverity
): MarkerSeverity {
  switch (severity) {
    case "error":
      return monacoInstance.MarkerSeverity.Error;
    case "warning":
      return monacoInstance.MarkerSeverity.Warning;
    case "information":
      return monacoInstance.MarkerSeverity.Info;
    case "hint":
      return monacoInstance.MarkerSeverity.Hint;
    default:
      return monacoInstance.MarkerSeverity.Error;
  }
}

/**
 * Convert diagnostics to Monaco markers for a file.
 */
function diagnosticsToMarkers(
  monacoInstance: Monaco,
  diagnostics: Diagnostic[]
): editor.IMarkerData[] {
  return diagnostics.map((diag) => ({
    severity: mapSeverity(monacoInstance, diag.severity),
    message: diag.message,
    startLineNumber: diag.startLine,
    startColumn: diag.startColumn,
    endLineNumber: diag.endLine,
    endColumn: diag.endColumn,
    source: diag.source,
    code: diag.code || undefined,
  }));
}

/**
 * Update Monaco markers for a specific file.
 */
export function updateMarkersForFile(
  filePath: string,
  diagnostics: Diagnostic[]
): void {
  if (!monaco) return;

  // Find the model for this file
  const uri = monaco.Uri.file(filePath);
  const model = monaco.editor.getModel(uri);

  if (!model) {
    // Model not open yet - markers will be set when file opens
    return;
  }

  const markers = diagnosticsToMarkers(monaco, diagnostics);
  monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
}

/**
 * Clear all diagnostic markers.
 */
export function clearAllMarkers(): void {
  if (!monaco) return;

  for (const model of monaco.editor.getModels()) {
    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
  }
}

/**
 * Sync all current diagnostics to Monaco markers.
 * Call this when Monaco initializes to apply any existing diagnostics.
 */
function syncAllDiagnostics(): void {
  if (!monaco) return;

  const diagnosticsByFile = useProblemsStore.getState().diagnosticsByFile;

  // Get all open models
  const models = monaco.editor.getModels();

  for (const model of models) {
    const filePath = model.uri.path;
    const diagnostics = diagnosticsByFile.get(filePath) || [];
    const markers = diagnosticsToMarkers(monaco, diagnostics);
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }
}

/**
 * Setup diagnostics markers sync.
 * Call this during Monaco initialization.
 */
export function setupDiagnosticsMarkers(monacoInstance: Monaco): void {
  monaco = monacoInstance;

  // Sync any existing diagnostics
  syncAllDiagnostics();

  // Subscribe to diagnostics changes
  unsubscribe = useProblemsStore.subscribe((state) => {
    if (!monaco) return;

    const diagnosticsByFile = state.diagnosticsByFile;

    // Update markers for all open models
    const models = monaco.editor.getModels();

    for (const model of models) {
      const filePath = model.uri.path;
      const diagnostics = diagnosticsByFile.get(filePath) || [];
      const markers = diagnosticsToMarkers(monaco, diagnostics);
      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    }
  });

  console.log("[Monaco] Diagnostics markers sync initialized");
}

/**
 * Cleanup diagnostics markers subscription.
 */
export function disposeDiagnosticsMarkers(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  clearAllMarkers();
  monaco = null;
}
