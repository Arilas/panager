//! Plugin management commands for IDE
//!
//! These commands allow the frontend to manage plugins:
//! - List available plugins
//! - Enable/disable plugins
//! - Get plugin status

use serde::Serialize;
use specta::Type;
use std::sync::Arc;
use tauri::State;

use crate::plugins::host::PluginHost;
use crate::plugins::types::{PluginManifest, PluginState};

/// Plugin information returned to frontend
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    /// Plugin metadata
    pub manifest: PluginManifest,
    /// Current state
    pub state: PluginState,
    /// Error message if state is Error
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// List all registered plugins
#[tauri::command]
#[specta::specta]
pub async fn ide_list_plugins(host: State<'_, Arc<PluginHost>>) -> Result<Vec<PluginInfo>, String> {
    let plugins = host.list_plugins().await;
    Ok(plugins
        .into_iter()
        .map(|(manifest, state, error)| PluginInfo {
            manifest,
            state,
            error,
        })
        .collect())
}

/// Enable (activate) a plugin
#[tauri::command]
#[specta::specta]
pub async fn ide_enable_plugin(
    host: State<'_, Arc<PluginHost>>,
    plugin_id: String,
) -> Result<(), String> {
    host.activate(&plugin_id).await
}

/// Disable (deactivate) a plugin
#[tauri::command]
#[specta::specta]
pub async fn ide_disable_plugin(
    host: State<'_, Arc<PluginHost>>,
    plugin_id: String,
) -> Result<(), String> {
    host.deactivate(&plugin_id).await
}

/// Get information about a specific plugin
#[tauri::command]
#[specta::specta]
pub async fn ide_get_plugin(
    host: State<'_, Arc<PluginHost>>,
    plugin_id: String,
) -> Result<Option<PluginInfo>, String> {
    let plugins = host.list_plugins().await;
    Ok(plugins
        .into_iter()
        .find(|(m, _, _)| m.id == plugin_id)
        .map(|(manifest, state, error)| PluginInfo {
            manifest,
            state,
            error,
        }))
}

/// Restart a plugin (deactivate then activate)
#[tauri::command]
#[specta::specta]
pub async fn ide_restart_plugin(
    host: State<'_, Arc<PluginHost>>,
    plugin_id: String,
) -> Result<(), String> {
    host.restart(&plugin_id).await
}
