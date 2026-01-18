/**
 * Diagnostic/Problems types
 * These types mirror the Rust plugin types for diagnostics
 */

/** Diagnostic severity levels (matches LSP specification) */
export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

/** A diagnostic/problem from a plugin */
export interface Diagnostic {
  id: string;
  filePath: string;
  severity: DiagnosticSeverity;
  message: string;
  source: string; // Plugin name (e.g., "TypeScript", "ESLint")
  code?: string; // Error code (e.g., "TS2322")
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** Summary of diagnostics counts */
export interface DiagnosticsSummary {
  errors: number;
  warnings: number;
  information: number;
  hints: number;
  total: number;
}

/** Diagnostics grouped by file */
export interface DiagnosticsByFile {
  [filePath: string]: Diagnostic[];
}
