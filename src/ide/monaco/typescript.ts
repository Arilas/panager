/**
 * TypeScript/JavaScript configuration for Monaco
 *
 * Configures Monaco's built-in TypeScript/JavaScript support:
 * - Disables validation (we use backend LSP instead)
 * - Enables JSX syntax highlighting for TSX/JSX files
 */

import type { Monaco } from "@monaco-editor/react";
import * as typescriptContribution from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";

/**
 * Configure Monaco's built-in TypeScript/JavaScript support.
 * Should be called once during Monaco initialization.
 */
export function configureTypeScript(_monaco: Monaco): void {
  // Disable TypeScript validation (we use backend LSP for diagnostics)
  // @ts-expect-error For some reason, the javascriptDefaults property is not available on the typescriptContribution module.
  typescriptContribution.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  // Disable JavaScript validation
  // @ts-expect-error For some reason, the javascriptDefaults property is not available on the typescriptContribution module.
  typescriptContribution.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  console.log("[Monaco] Configured TypeScript/JavaScript support with JSX");
}
