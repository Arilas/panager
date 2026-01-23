/**
 * Error Lens Decoration Manager
 *
 * Displays diagnostic messages inline at the end of affected lines with
 * background highlighting based on severity. Similar to the VS Code Error Lens extension.
 */

import type { editor } from "monaco-editor";
import { useProblemsStore } from "../../stores/problems";
import { useIdeSettingsStore } from "../../stores/settings";
import type { Diagnostic, DiagnosticSeverity } from "../../types/problems";
import {
  ERROR_LENS_ERROR_LINE_CLASS,
  ERROR_LENS_WARNING_LINE_CLASS,
  ERROR_LENS_INFO_LINE_CLASS,
  ERROR_LENS_HINT_LINE_CLASS,
  ERROR_LENS_ERROR_MESSAGE_CLASS,
  ERROR_LENS_WARNING_MESSAGE_CLASS,
  ERROR_LENS_INFO_MESSAGE_CLASS,
  ERROR_LENS_HINT_MESSAGE_CLASS,
} from "./styles";

/** Maximum length for inline messages before truncation */
const MAX_MESSAGE_LENGTH = 100;

/** Diagnostics grouped by line number */
interface LineDiagnostics {
  line: number;
  diagnostics: Diagnostic[];
  primarySeverity: DiagnosticSeverity;
}

/**
 * Get severity priority (lower = more severe)
 */
function getSeverityPriority(severity: DiagnosticSeverity): number {
  switch (severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "information":
      return 2;
    case "hint":
      return 3;
  }
}

/**
 * Get the CSS class for line background based on severity
 */
function getLineClassName(severity: DiagnosticSeverity): string {
  switch (severity) {
    case "error":
      return ERROR_LENS_ERROR_LINE_CLASS;
    case "warning":
      return ERROR_LENS_WARNING_LINE_CLASS;
    case "information":
      return ERROR_LENS_INFO_LINE_CLASS;
    case "hint":
      return ERROR_LENS_HINT_LINE_CLASS;
  }
}

/**
 * Get the CSS class for inline message based on severity
 */
function getMessageClassName(severity: DiagnosticSeverity): string {
  switch (severity) {
    case "error":
      return ERROR_LENS_ERROR_MESSAGE_CLASS;
    case "warning":
      return ERROR_LENS_WARNING_MESSAGE_CLASS;
    case "information":
      return ERROR_LENS_INFO_MESSAGE_CLASS;
    case "hint":
      return ERROR_LENS_HINT_MESSAGE_CLASS;
  }
}

/**
 * Group diagnostics by line number
 */
function groupDiagnosticsByLine(diagnostics: Diagnostic[]): Map<number, LineDiagnostics> {
  const lineMap = new Map<number, LineDiagnostics>();

  for (const diag of diagnostics) {
    const existing = lineMap.get(diag.startLine);
    if (existing) {
      existing.diagnostics.push(diag);
      // Update primary severity if this one is more severe
      if (getSeverityPriority(diag.severity) < getSeverityPriority(existing.primarySeverity)) {
        existing.primarySeverity = diag.severity;
      }
    } else {
      lineMap.set(diag.startLine, {
        line: diag.startLine,
        diagnostics: [diag],
        primarySeverity: diag.severity,
      });
    }
  }

  return lineMap;
}

/**
 * Check if a diagnostic should be shown based on settings
 */
function shouldShowDiagnostic(
  severity: DiagnosticSeverity,
  settings: { showErrors: boolean; showWarnings: boolean; showInformation: boolean; showHints: boolean }
): boolean {
  switch (severity) {
    case "error":
      return settings.showErrors;
    case "warning":
      return settings.showWarnings;
    case "information":
      return settings.showInformation;
    case "hint":
      return settings.showHints;
  }
}

/**
 * Manages Error Lens decorations for an editor instance.
 * Not a React hook - this is a plain class that can be used anywhere.
 */
export class ErrorLensManager {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private filePath: string | null = null;
  private decorations: string[] = [];
  private storeUnsubscribe: (() => void) | null = null;

  /**
   * Attach the manager to an editor instance.
   */
  attach(editorInstance: editor.IStandaloneCodeEditor, filePath: string): void {
    this.detach(); // Clean up any previous attachment

    this.editor = editorInstance;
    this.filePath = filePath;

    // Subscribe to problems store changes
    const problemsStore = useProblemsStore.getState();
    let prevDiagnostics = problemsStore.diagnosticsByFile.get(filePath);

    const problemsUnsubscribe = useProblemsStore.subscribe((state) => {
      const diagnostics = state.diagnosticsByFile.get(filePath);

      // Check if diagnostics changed (simple reference check)
      if (diagnostics !== prevDiagnostics) {
        prevDiagnostics = diagnostics;
        this.updateDecorations();
      }
    });

    // Subscribe to settings store changes
    let prevSettings = useIdeSettingsStore.getState().settings.editor.errorLens;

    const settingsUnsubscribe = useIdeSettingsStore.subscribe((state) => {
      const settings = state.settings.editor.errorLens;

      // Check if settings changed
      if (
        settings.enabled !== prevSettings.enabled ||
        settings.showErrors !== prevSettings.showErrors ||
        settings.showWarnings !== prevSettings.showWarnings ||
        settings.showInformation !== prevSettings.showInformation ||
        settings.showHints !== prevSettings.showHints
      ) {
        prevSettings = settings;
        this.updateDecorations();
      }
    });

    // Combine unsubscribe functions
    this.storeUnsubscribe = () => {
      problemsUnsubscribe();
      settingsUnsubscribe();
    };

    // Initial decorations
    this.updateDecorations();
  }

  /**
   * Detach the manager from the current editor.
   */
  detach(): void {
    this.clearDecorations();

    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    this.editor = null;
    this.filePath = null;
  }

  /**
   * Clear all error lens decorations.
   */
  private clearDecorations(): void {
    if (this.editor && this.decorations.length > 0) {
      try {
        this.decorations = this.editor.deltaDecorations(this.decorations, []);
      } catch {
        // Editor may be disposed
        this.decorations = [];
      }
    }
  }

  /**
   * Update error lens decorations based on current diagnostics.
   */
  private updateDecorations(): void {
    if (!this.editor || !this.filePath) return;

    // Check if error lens is enabled from settings store
    const errorLensSettings = useIdeSettingsStore.getState().settings.editor.errorLens;
    if (!errorLensSettings.enabled) {
      this.clearDecorations();
      return;
    }

    // Get diagnostics for this file
    const diagnostics = useProblemsStore.getState().diagnosticsByFile.get(this.filePath);

    // Clear existing decorations
    this.clearDecorations();

    // If no diagnostics, nothing to show
    if (!diagnostics || diagnostics.length === 0) {
      return;
    }

    // Filter diagnostics based on severity settings
    const filteredDiagnostics = diagnostics.filter((d) =>
      shouldShowDiagnostic(d.severity, errorLensSettings)
    );

    if (filteredDiagnostics.length === 0) {
      return;
    }

    // Group diagnostics by line
    const lineGroups = groupDiagnosticsByLine(filteredDiagnostics);

    // Build decorations
    const newDecorations: editor.IModelDeltaDecoration[] = [];

    for (const lineDiag of lineGroups.values()) {
      const { line, diagnostics: lineDiagnostics, primarySeverity } = lineDiag;

      // Get the primary diagnostic (most severe)
      const primaryDiag =
        lineDiagnostics.find((d) => d.severity === primarySeverity) || lineDiagnostics[0];

      // Format message with count if multiple
      let message = primaryDiag.message;
      if (lineDiagnostics.length > 1) {
        message = `${message} (+${lineDiagnostics.length - 1} more)`;
      }

      // Truncate long messages
      if (message.length > MAX_MESSAGE_LENGTH) {
        message = message.substring(0, MAX_MESSAGE_LENGTH) + "...";
      }

      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: getLineClassName(primarySeverity),
          after: {
            content: ` ${message}`,
            inlineClassName: getMessageClassName(primarySeverity),
          },
        },
      });
    }

    // Apply decorations
    if (newDecorations.length > 0) {
      this.decorations = this.editor.deltaDecorations([], newDecorations);
    }
  }

  /**
   * Force a refresh of decorations.
   */
  refresh(): void {
    this.updateDecorations();
  }
}

// Singleton instance for use across the app
export const errorLensManager = new ErrorLensManager();
