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
  /** Text edit to apply when selecting this completion */
  textEdit?: LspTextEdit;
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

/** Symbol kind constants (from LSP specification) */
export const SymbolKind = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
  Object: 19,
  Key: 20,
  Null: 21,
  EnumMember: 22,
  Struct: 23,
  Event: 24,
  Operator: 25,
  TypeParameter: 26,
} as const;

/** LSP Document Symbol - represents a symbol (function, class, etc.) in a document */
export interface LspDocumentSymbol {
  /** Symbol name */
  name: string;
  /** Symbol kind (see SymbolKind constants) */
  kind: number;
  /** The range enclosing this symbol (full extent) */
  range: LspRange;
  /** The range that should be selected when navigating to this symbol */
  selectionRange: LspRange;
  /** Additional detail (e.g., signature) */
  detail?: string;
  /** Children symbols (nested declarations) */
  children?: LspDocumentSymbol[];
}

/** Inlay hint kind constants (from LSP specification) */
export const InlayHintKind = {
  /** Type hint - shows inferred type */
  Type: 1,
  /** Parameter hint - shows parameter name */
  Parameter: 2,
} as const;

/** LSP Inlay Hint - inline hints for type/parameter information */
export interface LspInlayHint {
  /** Position where the hint should be displayed */
  position: LspPosition;
  /** Label text to display */
  label: string;
  /** Kind of inlay hint (Type or Parameter) */
  kind?: (typeof InlayHintKind)[keyof typeof InlayHintKind];
  /** Add padding before the hint */
  paddingLeft?: boolean;
  /** Add padding after the hint */
  paddingRight?: boolean;
}

// =============================================================================
// Document Highlight
// =============================================================================

/** Document highlight kind constants (from LSP specification) */
export const DocumentHighlightKind = {
  /** A textual occurrence */
  Text: 1,
  /** Read-access of a symbol */
  Read: 2,
  /** Write-access of a symbol */
  Write: 3,
} as const;

/** LSP Document Highlight - highlights occurrences of symbol under cursor */
export interface LspDocumentHighlight {
  /** Range to highlight */
  range: LspRange;
  /** Kind of highlight (Text, Read, or Write) */
  kind?: (typeof DocumentHighlightKind)[keyof typeof DocumentHighlightKind];
}

// =============================================================================
// Signature Help
// =============================================================================

/** LSP Parameter information - describes a parameter of a callable signature */
export interface LspParameterInformation {
  /** The label (parameter name) - either a string or [start, end] offsets into the signature label */
  label: string | [number, number];
  /** Documentation for this parameter */
  documentation?: LspMarkupContent | string;
}

/** LSP Signature information - describes a callable signature */
export interface LspSignatureInformation {
  /** The label of this signature (e.g., "fn(x: number, y: string): boolean") */
  label: string;
  /** Documentation for this signature */
  documentation?: LspMarkupContent | string;
  /** The parameters of this signature */
  parameters?: LspParameterInformation[];
  /** The index of the active parameter (overrides SignatureHelp.activeParameter) */
  activeParameter?: number;
}

/** LSP Signature Help - function parameter hints when typing */
export interface LspSignatureHelp {
  /** One or more signatures */
  signatures: LspSignatureInformation[];
  /** The active signature (0-indexed) */
  activeSignature?: number;
  /** The active parameter of the active signature (0-indexed) */
  activeParameter?: number;
}

// =============================================================================
// Formatting
// =============================================================================

/** LSP Formatting options - editor formatting preferences */
export interface LspFormattingOptions {
  /** Size of a tab in spaces */
  tabSize: number;
  /** Prefer spaces over tabs */
  insertSpaces: boolean;
}

// =============================================================================
// Folding Range
// =============================================================================

/** Folding range kind constants (from LSP specification) */
export const FoldingRangeKind = {
  /** Folding range for comments */
  Comment: "comment",
  /** Folding range for imports */
  Imports: "imports",
  /** Folding range for region markers (e.g., #region) */
  Region: "region",
} as const;

/** LSP Folding Range - represents a foldable region of code */
export interface LspFoldingRange {
  /** Start line (0-indexed) */
  startLine: number;
  /** Start character (optional) */
  startCharacter?: number;
  /** End line (0-indexed) */
  endLine: number;
  /** End character (optional) */
  endCharacter?: number;
  /** Kind of folding range (comment, imports, region) */
  kind?: string;
}

// =============================================================================
// Selection Range
// =============================================================================

/** LSP Selection Range - nested ranges for smart selection (expand/shrink) */
export interface LspSelectionRange {
  /** The range of this selection */
  range: LspRange;
  /** The parent selection range (allows for nested selections) */
  parent?: LspSelectionRange;
}

// =============================================================================
// Linked Editing Ranges
// =============================================================================

/** LSP Linked Editing Ranges - ranges that should be edited simultaneously (e.g., HTML tag pairs) */
export interface LspLinkedEditingRanges {
  /** List of ranges that are linked */
  ranges: LspRange[];
  /** An optional word pattern to describe valid contents */
  wordPattern?: string;
}
