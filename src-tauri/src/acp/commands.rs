//! ACP Tauri Commands
//!
//! These commands are exposed to the frontend for ACP operations.

use std::sync::Arc;
use tauri::{AppHandle, State};

use super::process::AcpState;
use super::types::*;

/// Connect to ACP agent for a project
#[tauri::command]
pub async fn acp_connect(
    project_path: String,
    app_handle: AppHandle,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await;
    let mut p = process.lock().await;

    if p.is_running() {
        return Ok(());
    }

    p.spawn(app_handle).await
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
    let process = state.get_or_create(&project_path).await;
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
    let process = state.get_or_create(&project_path).await;
    let mut p = process.lock().await;

    if !p.is_running() {
        p.spawn(app_handle.clone()).await?;
    }

    p.new_session(mode, &app_handle).await
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
    let process = state.get_or_create(&project_path).await;
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
    let process = state.get_or_create(&project_path).await;
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
    let process = state.get_or_create(&project_path).await;
    let mut p = process.lock().await;

    if !p.is_running() {
        return Err("ACP not connected".to_string());
    }

    p.set_mode(&session_id, mode, &app_handle).await
}

/// Respond to a permission request
#[tauri::command]
pub async fn acp_respond_permission(
    project_path: String,
    request_id: String,
    selected_option: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<(), String> {
    let process = state.get_or_create(&project_path).await;
    let p = process.lock().await;

    if !p.is_running() {
        return Err("ACP not connected".to_string());
    }

    p.respond_permission(&request_id, selected_option).await
}

/// Get current session ID
#[tauri::command]
pub async fn acp_get_current_session(
    project_path: String,
    state: State<'_, Arc<AcpState>>,
) -> Result<Option<String>, String> {
    let process = state.get_or_create(&project_path).await;
    let p = process.lock().await;
    Ok(p.current_session_id().map(|s| s.to_string()))
}
