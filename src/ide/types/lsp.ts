/**
 * LSP Response Types
 *
 * These types match the Rust LSP types from plugins/types.rs
 * Used for communication between Monaco editor and the backend LSP
 */

/** LSP Position (line + character, both 0-indexed) */
export interface LspPosition {
  line: number;
  character: number;
}

/** LSP Range (start + end positions) */
export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

/** LSP Location (file URI + range) */
export interface LspLocation {
  uri: string;
  range: LspRange;
}

/** LSP Markup content (markdown or plaintext) */
export interface LspMarkupContent {
  kind: "markdown" | "plaintext";
  value: string;
}

/** LSP Hover response */
export interface LspHover {
  contents: LspMarkupContent;
  range?: LspRange;
}

/** LSP Completion item */
export interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: LspMarkupContent;
  insertText?: string;
  insertTextFormat?: number;
  sortText?: string;
  filterText?: string;
}

/** LSP Completion list */
export interface LspCompletionList {
  isIncomplete: boolean;
  items: LspCompletionItem[];
}

/** LSP Text edit */
export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

/** LSP Versioned text document identifier */
export interface LspVersionedTextDocumentIdentifier {
  uri: string;
  version?: number;
}

/** LSP Text document edit */
export interface LspTextDocumentEdit {
  textDocument: LspVersionedTextDocumentIdentifier;
  edits: LspTextEdit[];
}

/** LSP Workspace edit */
export interface LspWorkspaceEdit {
  changes?: Record<string, LspTextEdit[]>;
  documentChanges?: LspTextDocumentEdit[];
}

/** LSP Command */
export interface LspCommand {
  title: string;
  command: string;
  arguments?: unknown[];
}

/** LSP Code action */
export interface LspCodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: LspWorkspaceEdit;
  command?: LspCommand;
}
