//! Plugin system type definitions
//!
//! This module defines the core types for the plugin SDK including:
//! - Plugin manifests and state
//! - Diagnostics (problems/errors/warnings)
//! - Status bar items
//! - Events for plugin communication
//! - LSP response types

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;

use super::context::PluginContext;

// ============================================================================
// Plugin Metadata & State
// ============================================================================

/// Plugin metadata - describes a plugin's identity and capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    /// Unique plugin identifier (e.g., "panager.typescript")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Plugin version (semver)
    pub version: String,
    /// Description of what the plugin does
    pub description: String,
    /// Languages this plugin supports (e.g., ["typescript", "javascript"])
    pub languages: Vec<String>,
    /// Whether this is a built-in plugin
    pub is_builtin: bool,
}

/// Plugin lifecycle state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum PluginState {
    /// Plugin is registered but not running
    Inactive,
    /// Plugin is starting up
    Activating,
    /// Plugin is running and ready
    Active,
    /// Plugin is shutting down
    Deactivating,
    /// Plugin encountered an error
    Error,
}

impl Default for PluginState {
    fn default() -> Self {
        Self::Inactive
    }
}

// ============================================================================
// Diagnostics (Problems/Errors/Warnings)
// ============================================================================

/// Diagnostic severity levels (matches LSP specification)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticSeverity {
    /// Error - something is wrong
    Error,
    /// Warning - potential issue
    Warning,
    /// Information - informational message
    Information,
    /// Hint - suggestion for improvement
    Hint,
}

impl DiagnosticSeverity {
    /// Convert from LSP severity number (1=Error, 2=Warning, 3=Info, 4=Hint)
    pub fn from_lsp(severity: u32) -> Self {
        match severity {
            1 => Self::Error,
            2 => Self::Warning,
            3 => Self::Information,
            4 => Self::Hint,
            _ => Self::Information,
        }
    }
}

/// A diagnostic message (error, warning, etc.) from a plugin
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    /// Unique identifier for this diagnostic
    pub id: String,
    /// Absolute path to the file
    pub file_path: String,
    /// Severity level
    pub severity: DiagnosticSeverity,
    /// The diagnostic message
    pub message: String,
    /// Source of this diagnostic (plugin name)
    pub source: String,
    /// Optional error/warning code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    /// Start line (1-indexed)
    pub start_line: u32,
    /// Start column (1-indexed)
    pub start_column: u32,
    /// End line (1-indexed)
    pub end_line: u32,
    /// End column (1-indexed)
    pub end_column: u32,
}

// ============================================================================
// Status Bar
// ============================================================================

/// Alignment for status bar items
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum StatusBarAlignment {
    /// Show on the left side of the status bar
    Left,
    /// Show on the right side of the status bar
    Right,
}

/// A status bar item contributed by a plugin
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StatusBarItem {
    /// Unique identifier for this item
    pub id: String,
    /// Text to display
    pub text: String,
    /// Optional tooltip on hover
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tooltip: Option<String>,
    /// Which side of the status bar
    pub alignment: StatusBarAlignment,
    /// Priority (higher = closer to the edge)
    pub priority: i32,
}

// ============================================================================
// Plugin Events
// ============================================================================

/// Events that plugins can emit to the frontend
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginEvent {
    /// Diagnostics were updated for a file
    DiagnosticsUpdated {
        plugin_id: String,
        file_path: String,
        diagnostics: Vec<Diagnostic>,
    },
    /// Diagnostics were cleared
    DiagnosticsCleared {
        plugin_id: String,
        /// If None, all diagnostics from this plugin are cleared
        file_path: Option<String>,
    },
    /// Status bar item was updated
    StatusBarUpdated {
        plugin_id: String,
        item: StatusBarItem,
    },
    /// Status bar item was removed
    StatusBarRemoved {
        plugin_id: String,
        item_id: String,
    },
    /// Plugin state changed
    PluginStateChanged {
        plugin_id: String,
        state: PluginState,
        error: Option<String>,
    },
}

/// Events that the host sends to plugins
#[derive(Debug, Clone)]
pub enum HostEvent {
    /// A file was opened in the editor
    FileOpened {
        path: PathBuf,
        content: String,
        language: String,
    },
    /// A file was closed
    FileClosed {
        path: PathBuf,
    },
    /// File content changed (user is typing)
    FileChanged {
        path: PathBuf,
        content: String,
    },
    /// File was saved
    FileSaved {
        path: PathBuf,
    },
    /// Project was opened
    ProjectOpened {
        path: PathBuf,
    },
    /// Project was closed
    ProjectClosed,
}

// ============================================================================
// Plugin Trait
// ============================================================================

/// The main plugin trait - all plugins must implement this
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Get plugin metadata
    fn manifest(&self) -> &PluginManifest;

    /// Called when plugin is activated
    async fn activate(&mut self, ctx: PluginContext) -> Result<(), String>;

    /// Called when plugin is deactivated
    async fn deactivate(&mut self) -> Result<(), String>;

    /// Handle events from the host
    async fn on_event(&mut self, event: HostEvent) -> Result<(), String>;

    /// Check if plugin supports a language
    fn supports_language(&self, language: &str) -> bool {
        self.manifest().languages.contains(&language.to_string())
            || self.manifest().languages.contains(&"*".to_string())
    }

    /// Get LSP provider if this plugin provides one
    fn as_lsp_provider(&self) -> Option<&dyn LspProvider> {
        None
    }
}

// ============================================================================
// LSP Response Types
// ============================================================================

/// LSP Location (file URI + range)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspLocation {
    pub uri: String,
    pub range: LspRange,
}

/// LSP Range (start + end positions)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspRange {
    pub start: LspPosition,
    pub end: LspPosition,
}

/// LSP Position (line + character, both 0-indexed)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspPosition {
    pub line: u32,
    pub character: u32,
}

/// LSP Hover response
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspHover {
    pub contents: LspMarkupContent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<LspRange>,
}

/// LSP Markup content (markdown or plaintext)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspMarkupContent {
    pub kind: String, // "markdown" or "plaintext"
    pub value: String,
}

/// LSP Completion list
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionList {
    pub is_incomplete: bool,
    pub items: Vec<LspCompletionItem>,
}

/// LSP Completion item
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionItem {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<LspMarkupContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text_format: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_text: Option<String>,
    /// Text edit to apply when selecting this completion
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_edit: Option<LspTextEdit>,
}

/// LSP Code action
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspCodeAction {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<Vec<Diagnostic>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_preferred: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit: Option<LspWorkspaceEdit>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<LspCommand>,
}

/// LSP Workspace edit
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspWorkspaceEdit {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<HashMap<String, Vec<LspTextEdit>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_changes: Option<Vec<LspTextDocumentEdit>>,
}

/// LSP Text edit
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspTextEdit {
    pub range: LspRange,
    pub new_text: String,
}

/// LSP Text document edit
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspTextDocumentEdit {
    pub text_document: LspVersionedTextDocumentIdentifier,
    pub edits: Vec<LspTextEdit>,
}

/// LSP Versioned text document identifier
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspVersionedTextDocumentIdentifier {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
}

/// LSP Command
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspCommand {
    pub title: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<Vec<serde_json::Value>>,
}

/// LSP Document Symbol - represents a symbol (function, class, etc.) in a document
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspDocumentSymbol {
    /// Symbol name
    pub name: String,
    /// Symbol kind (1=File, 5=Class, 6=Method, 12=Function, 13=Variable, etc.)
    pub kind: u32,
    /// The range enclosing this symbol (full extent)
    pub range: LspRange,
    /// The range that should be selected when navigating to this symbol
    pub selection_range: LspRange,
    /// Additional detail (e.g., signature)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// Children symbols (nested declarations)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<LspDocumentSymbol>>,
}

/// LSP Inlay Hint Kind (1=Type, 2=Parameter)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LspInlayHintKind {
    /// Type hint (shows inferred type)
    Type = 1,
    /// Parameter hint (shows parameter name)
    Parameter = 2,
}

/// LSP Inlay Hint - inline hints for type/parameter information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspInlayHint {
    /// Position where the hint should be displayed
    pub position: LspPosition,
    /// Label text to display
    pub label: String,
    /// Kind of inlay hint (Type or Parameter)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<LspInlayHintKind>,
    /// Add padding before the hint
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding_left: Option<bool>,
    /// Add padding after the hint
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding_right: Option<bool>,
}

/// LSP Document Highlight - highlight occurrences of a symbol
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspDocumentHighlight {
    pub range: LspRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<u32>, // 1=Text, 2=Read, 3=Write
}

/// LSP Parameter label - can be a string or [start, end] offsets
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(untagged)]
pub enum LspParameterLabel {
    String(String),
    Offsets([u32; 2]),
}

/// LSP Parameter information for signature help
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspParameterInformation {
    pub label: LspParameterLabel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<LspMarkupContent>,
}

/// LSP Signature information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspSignatureInformation {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<LspMarkupContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<LspParameterInformation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_parameter: Option<u32>,
}

/// LSP Signature help response
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspSignatureHelp {
    pub signatures: Vec<LspSignatureInformation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_signature: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_parameter: Option<u32>,
}

/// LSP Formatting options
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspFormattingOptions {
    pub tab_size: u32,
    pub insert_spaces: bool,
}

/// LSP Folding range
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspFoldingRange {
    pub start_line: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_character: Option<u32>,
    pub end_line: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_character: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>, // "comment", "imports", "region"
}

/// LSP Selection range (for smart select)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspSelectionRange {
    pub range: LspRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<Box<LspSelectionRange>>,
}

/// LSP Linked editing ranges (for tag renaming)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LspLinkedEditingRanges {
    pub ranges: Vec<LspRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_pattern: Option<String>,
}

// ============================================================================
// LSP Provider Trait
// ============================================================================

/// Trait for plugins that provide LSP functionality
#[async_trait]
pub trait LspProvider: Send + Sync {
    /// Go to definition
    async fn goto_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String>;

    /// Get hover information
    async fn hover(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspHover>, String>;

    /// Get completions
    async fn completion(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<LspCompletionList, String>;

    /// Find references
    async fn references(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        include_declaration: bool,
    ) -> Result<Vec<LspLocation>, String>;

    /// Rename symbol
    async fn rename(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        new_name: &str,
    ) -> Result<LspWorkspaceEdit, String>;

    /// Get code actions
    async fn code_action(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        diagnostics: Vec<serde_json::Value>,
    ) -> Result<Vec<LspCodeAction>, String>;

    /// Get document symbols (functions, classes, etc.)
    async fn document_symbols(&self, path: &PathBuf) -> Result<Vec<LspDocumentSymbol>, String>;

    /// Get inlay hints for a range
    async fn inlay_hints(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
    ) -> Result<Vec<LspInlayHint>, String>;

    /// Get document highlights (highlight all occurrences of symbol)
    async fn document_highlight(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspDocumentHighlight>, String>;

    /// Get signature help (parameter hints)
    async fn signature_help(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: Option<&str>,
    ) -> Result<Option<LspSignatureHelp>, String>;

    /// Format entire document
    async fn format_document(
        &self,
        path: &PathBuf,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String>;

    /// Format a range in document
    async fn format_range(
        &self,
        path: &PathBuf,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String>;

    /// Format on type (triggered by specific characters)
    async fn format_on_type(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
        trigger_character: &str,
        options: LspFormattingOptions,
    ) -> Result<Vec<LspTextEdit>, String>;

    /// Go to type definition
    async fn type_definition(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String>;

    /// Go to implementation
    async fn implementation(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Vec<LspLocation>, String>;

    /// Get folding ranges
    async fn folding_range(&self, path: &PathBuf) -> Result<Vec<LspFoldingRange>, String>;

    /// Get selection ranges (smart select)
    async fn selection_range(
        &self,
        path: &PathBuf,
        positions: Vec<LspPosition>,
    ) -> Result<Vec<LspSelectionRange>, String>;

    /// Get linked editing ranges (tag renaming)
    async fn linked_editing_range(
        &self,
        path: &PathBuf,
        line: u32,
        character: u32,
    ) -> Result<Option<LspLinkedEditingRanges>, String>;
}
