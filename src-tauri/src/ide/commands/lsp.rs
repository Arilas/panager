//! LSP Command handlers
//!
//! These commands provide LSP functionality to the frontend by delegating
//! to the appropriate plugin's LSP provider.

use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::plugins::host::PluginHost;
use crate::plugins::types::{
    LspCodeAction, LspCompletionList, LspDocumentSymbol, LspHover, LspLocation, LspWorkspaceEdit,
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
