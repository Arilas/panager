//! LSP Command handlers
//!
//! These commands provide LSP functionality to the frontend by delegating
//! to the appropriate plugin's LSP provider.

use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::plugins::host::PluginHost;
use crate::plugins::types::{
    LspCodeAction, LspCompletionList, LspDocumentHighlight, LspDocumentSymbol, LspFoldingRange,
    LspFormattingOptions, LspHover, LspInlayHint, LspLinkedEditingRanges, LspLocation, LspPosition,
    LspSelectionRange, LspSignatureHelp, LspTextEdit, LspWorkspaceEdit,
};

/// Get language ID from file path
fn get_language_from_path(path: &str) -> String {
    match path.rsplit('.').next() {
        Some("ts") => "typescript",
        Some("tsx") => "typescriptreact",
        Some("js") => "javascript",
        Some("jsx") => "javascriptreact",
        Some("mts") => "typescript",
        Some("cts") => "typescript",
        Some("mjs") => "javascript",
        Some("cjs") => "javascript",
        _ => "plaintext",
    }
    .to_string()
}

/// Go to definition
#[tauri::command]
pub async fn ide_lsp_goto_definition(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<LspLocation>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_goto_definition(&language, &path, line, character)
        .await
}

/// Get hover information
#[tauri::command]
pub async fn ide_lsp_hover(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Option<LspHover>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_hover(&language, &path, line, character).await
}

/// Get completions
#[tauri::command]
pub async fn ide_lsp_completion(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
    trigger_character: Option<String>,
) -> Result<LspCompletionList, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_completion(&language, &path, line, character, trigger_character.as_deref())
        .await
}

/// Find references
#[tauri::command]
pub async fn ide_lsp_references(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
    include_declaration: bool,
) -> Result<Vec<LspLocation>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_references(&language, &path, line, character, include_declaration)
        .await
}

/// Rename symbol
#[tauri::command]
pub async fn ide_lsp_rename(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
    new_name: String,
) -> Result<LspWorkspaceEdit, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_rename(&language, &path, line, character, &new_name)
        .await
}

/// Get code actions
#[tauri::command]
pub async fn ide_lsp_code_action(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    start_line: u32,
    start_character: u32,
    end_line: u32,
    end_character: u32,
    diagnostics: Vec<serde_json::Value>,
) -> Result<Vec<LspCodeAction>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_code_action(
        &language,
        &path,
        start_line,
        start_character,
        end_line,
        end_character,
        diagnostics,
    )
    .await
}

/// Get document symbols (functions, classes, etc.)
#[tauri::command]
pub async fn ide_lsp_document_symbols(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
) -> Result<Vec<LspDocumentSymbol>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_document_symbols(&language, &path).await
}

/// Get inlay hints for a range
#[tauri::command]
pub async fn ide_lsp_inlay_hints(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    start_line: u32,
    start_character: u32,
    end_line: u32,
    end_character: u32,
) -> Result<Vec<LspInlayHint>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_inlay_hints(&language, &path, start_line, start_character, end_line, end_character)
        .await
}

/// Get document highlights (highlight all occurrences of symbol)
#[tauri::command]
pub async fn ide_lsp_document_highlight(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<LspDocumentHighlight>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_document_highlight(&language, &path, line, character)
        .await
}

/// Get signature help (parameter hints)
#[tauri::command]
pub async fn ide_lsp_signature_help(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
    trigger_character: Option<String>,
) -> Result<Option<LspSignatureHelp>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_signature_help(&language, &path, line, character, trigger_character.as_deref())
        .await
}

/// Format entire document
#[tauri::command]
pub async fn ide_lsp_format_document(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    tab_size: u32,
    insert_spaces: bool,
) -> Result<Vec<LspTextEdit>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    let options = LspFormattingOptions {
        tab_size,
        insert_spaces,
    };
    host.lsp_format_document(&language, &path, options).await
}

/// Format a range in document
#[tauri::command]
pub async fn ide_lsp_format_range(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    start_line: u32,
    start_character: u32,
    end_line: u32,
    end_character: u32,
    tab_size: u32,
    insert_spaces: bool,
) -> Result<Vec<LspTextEdit>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    let options = LspFormattingOptions {
        tab_size,
        insert_spaces,
    };
    host.lsp_format_range(
        &language,
        &path,
        start_line,
        start_character,
        end_line,
        end_character,
        options,
    )
    .await
}

/// Format on type
#[tauri::command]
pub async fn ide_lsp_format_on_type(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
    trigger_character: String,
    tab_size: u32,
    insert_spaces: bool,
) -> Result<Vec<LspTextEdit>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    let options = LspFormattingOptions {
        tab_size,
        insert_spaces,
    };
    host.lsp_format_on_type(&language, &path, line, character, &trigger_character, options)
        .await
}

/// Go to type definition
#[tauri::command]
pub async fn ide_lsp_type_definition(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<LspLocation>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_type_definition(&language, &path, line, character)
        .await
}

/// Go to implementation
#[tauri::command]
pub async fn ide_lsp_implementation(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Vec<LspLocation>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_implementation(&language, &path, line, character)
        .await
}

/// Get folding ranges
#[tauri::command]
pub async fn ide_lsp_folding_range(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
) -> Result<Vec<LspFoldingRange>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_folding_range(&language, &path).await
}

/// Get selection ranges (smart select)
#[tauri::command]
pub async fn ide_lsp_selection_range(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    positions: Vec<LspPosition>,
) -> Result<Vec<LspSelectionRange>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_selection_range(&language, &path, positions).await
}

/// Get linked editing ranges (tag renaming)
#[tauri::command]
pub async fn ide_lsp_linked_editing_range(
    host: State<'_, Arc<PluginHost>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<Option<LspLinkedEditingRanges>, String> {
    let language = get_language_from_path(&file_path);
    let path = PathBuf::from(&file_path);
    host.lsp_linked_editing_range(&language, &path, line, character)
        .await
}
