/**
 * TypeScript/JavaScript configuration for Monaco
 *
 * Configures Monaco's built-in TypeScript/JavaScript support:
 * - Disables validation (we use backend LSP instead)
 * - Enables JSX syntax highlighting for TSX/JSX files
 */

import type { Monaco } from "@monaco-editor/react";

/**
 * Configure Monaco's built-in TypeScript/JavaScript support.
 * Should be called once during Monaco initialization.
 */
export function configureTypeScript(monaco: Monaco): void {
  // Configure TypeScript compiler options for JSX support
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "React.createElement",
    reactNamespace: "React",
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
    noEmit: true,
    strict: true,
  });

  // Configure JavaScript compiler options for JSX support
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "React.createElement",
    reactNamespace: "React",
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    esModuleInterop: true,
    noEmit: true,
  });

  // Disable TypeScript validation (we use backend LSP for diagnostics)
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  // Disable JavaScript validation
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  console.log("[Monaco] Configured TypeScript/JavaScript support with JSX");
}
