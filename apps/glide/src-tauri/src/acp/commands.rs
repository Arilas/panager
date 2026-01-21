//! ACP Tauri Commands
//!
//! These commands are exposed to the frontend for ACP operations.

use std::sync::Arc;
use tauri::{AppHandle, State};

use super::process::AcpState;
use super::types::*;
use crate::ide::db::{DbSessionInfo, DbSessionWithEntries};

/// Connect to ACP agent for a project
#[tauri::command]
pub async fn acp_connect(
    project_path: String,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if p.is_running() {
        return Ok(());
    }

    let command_tx = p.spawn(app_handle).await?;
    // Register the command channel for permission responses (avoids deadlock)
    state.register_command_channel(&project_path, command_tx).await;
    Ok(())
}

/// Disconnect from ACP agent
#[tauri::command]
pub async fn acp_disconnect(
    project_path: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    state.remove(&project_path).await;
    Ok(())
}

/// Get ACP connection status
#[tauri::command]
pub async fn acp_get_status(
    project_path: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<SessionStatus, String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    Ok(p.status())
}

/// Create a new ACP session
#[tauri::command]
pub async fn acp_new_session(
    project_path: String,
    mode: Option<AgentMode>,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<String, String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if !p.is_running() {
        let command_tx = p.spawn(app_handle.clone()).await?;
        // Register the command channel for permission responses (avoids deadlock)
        state.register_command_channel(&project_path, command_tx).await;
    }

    p.new_session(mode, &app_handle).await
}

/// Resume an existing session from the database
/// Creates a new ACP session and maps it to the existing DB session ID
#[tauri::command]
pub async fn acp_resume_session(
    project_path: String,
    session_id: String,
    mode: Option<AgentMode>,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<String, String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if !p.is_running() {
        let command_tx = p.spawn(app_handle.clone()).await?;
        // Register the command channel for permission responses (avoids deadlock)
        state.register_command_channel(&project_path, command_tx).await;
    }

    p.resume_session(&session_id, mode, &app_handle).await
}

/// Send a prompt to the ACP session
#[tauri::command]
pub async fn acp_send_prompt(
    project_path: String,
    session_id: String,
    content: Vec<ContentBlock>,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if !p.is_running() {
        return Err("ACP not connected".to_string());
    }

    p.send_prompt(&session_id, content, &app_handle).await
}

/// Cancel the current prompt
#[tauri::command]
pub async fn acp_cancel(
    project_path: String,
    session_id: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if !p.is_running() {
        return Err("ACP not connected".to_string());
    }

    p.cancel(&session_id).await
}

/// Set the session mode
#[tauri::command]
pub async fn acp_set_mode(
    project_path: String,
    session_id: String,
    mode: AgentMode,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let mut p = process.lock().await;

    if !p.is_running() {
        return Err("ACP not connected".to_string());
    }

    p.set_mode(&session_id, mode, &app_handle).await
}

/// Respond to a permission request
/// NOTE: This uses a separate channel to avoid deadlock - during a prompt,
/// the process lock is held while waiting for permission responses.
#[tauri::command]
pub async fn acp_respond_permission(
    project_path: String,
    request_id: String,
    selected_option: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    tracing::info!("ACP Command: acp_respond_permission called with request_id={}, option={}", request_id, selected_option);

    // Use state.respond_permission which doesn't lock the process
    // This avoids deadlock when a prompt is waiting for permission
    state.respond_permission(&project_path, &request_id, selected_option).await
}

/// Get current session ID
#[tauri::command]
pub async fn acp_get_current_session(
    project_path: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<Option<String>, String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    Ok(p.current_session_id().map(|s| s.to_string()))
}

// ============================================================
// Database Commands
// ============================================================

/// List all chat sessions for a project
#[tauri::command]
pub async fn acp_list_sessions(
    project_path: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<Vec<DbSessionInfo>, String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    p.list_sessions()
}

/// Load a chat session with all its entries
#[tauri::command]
pub async fn acp_load_session(
    project_path: String,
    session_id: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<Option<DbSessionWithEntries>, String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    p.load_session(&session_id)
}

/// Delete a chat session
#[tauri::command]
pub async fn acp_delete_session(
    project_path: String,
    session_id: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    p.delete_session(&session_id)
}

/// Update session name
#[tauri::command]
pub async fn acp_update_session_name(
    project_path: String,
    session_id: String,
    name: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await?;
    let p = process.lock().await;
    p.update_session_name(&session_id, &name)
}
