//! IDE Settings Commands
//!
//! Tauri commands for loading, saving, and managing IDE settings.

use crate::ide::settings::{
    self, FormatterConfig, IdeSettings, PartialIdeSettings, SettingsLevel,
};
use serde_json::Value;
use tracing::info;

/// Load merged effective settings (user → scope → workspace)
///
/// This is the main API for getting settings - returns ready-to-use settings
/// with all levels merged according to the hierarchy.
#[tauri::command]
#[specta::specta]
pub fn ide_load_settings(
    project_path: String,
    scope_default_folder: Option<String>,
) -> Result<IdeSettings, String> {
    info!(
        "Loading IDE settings for project: {} (scope folder: {:?})",
        project_path, scope_default_folder
    );

    settings::load_merged_settings(&project_path, scope_default_folder.as_deref())
}

/// Load settings merged up to a specific level
///
/// - User: defaults + user settings only
/// - Scope: defaults + user + scope settings
/// - Workspace: defaults + user + scope + workspace settings (same as ide_load_settings)
///
/// This is used by the settings dialog to show the effective settings at each level.
#[tauri::command]
#[specta::specta]
pub fn ide_load_settings_for_level(
    level: SettingsLevel,
    project_path: String,
    scope_default_folder: Option<String>,
) -> Result<IdeSettings, String> {
    info!(
        "Loading IDE settings up to level {:?} for project: {}",
        level, project_path
    );

    settings::load_merged_settings_up_to(level, &project_path, scope_default_folder.as_deref())
}

/// Get raw settings for a specific level (for settings dialog editing)
///
/// Returns only the settings explicitly set at this level, not merged.
/// This allows the UI to show which settings are overridden at each level.
#[tauri::command]
#[specta::specta]
pub fn ide_get_settings_for_level(
    level: SettingsLevel,
    project_path: Option<String>,
    scope_default_folder: Option<String>,
) -> Result<PartialIdeSettings, String> {
    info!("Getting settings for level: {:?}", level);

    settings::load_level_settings(
        level,
        project_path.as_deref(),
        scope_default_folder.as_deref(),
    )
}

/// Update a setting at a specific level
///
/// Uses dot-notation key path (e.g., "editor.fontSize", "git.blame.enabled").
#[tauri::command]
#[specta::specta]
pub fn ide_update_setting(
    level: SettingsLevel,
    key: String,
    value: Value,
    project_path: Option<String>,
    scope_default_folder: Option<String>,
) -> Result<(), String> {
    info!("Updating setting at {:?}: {} = {:?}", level, key, value);

    settings::update_setting(
        level,
        &key,
        value,
        project_path.as_deref(),
        scope_default_folder.as_deref(),
    )
}

/// Delete a setting at a specific level (revert to lower level)
///
/// Removes the setting from this level, causing it to inherit from
/// the next level down (scope → user → default).
#[tauri::command]
#[specta::specta]
pub fn ide_delete_setting(
    level: SettingsLevel,
    key: String,
    project_path: Option<String>,
    scope_default_folder: Option<String>,
) -> Result<(), String> {
    info!("Deleting setting at {:?}: {}", level, key);

    settings::delete_setting(
        level,
        &key,
        project_path.as_deref(),
        scope_default_folder.as_deref(),
    )
}

/// Get available formatter presets
///
/// Returns the list of built-in formatter configurations that users
/// can add to their settings.
#[tauri::command]
#[specta::specta]
pub fn ide_get_formatter_presets() -> Vec<FormatterConfig> {
    settings::get_formatter_presets()
}

/// Get the path where settings would be stored for a given level
///
/// Useful for the UI to show users where their settings files are located.
#[tauri::command]
#[specta::specta]
pub fn ide_get_settings_path(
    level: SettingsLevel,
    project_path: Option<String>,
    scope_default_folder: Option<String>,
) -> Result<String, String> {
    let path = match level {
        SettingsLevel::User => settings::get_user_settings_path(),
        SettingsLevel::Scope => {
            let folder = scope_default_folder
                .ok_or("Scope default folder is required for scope settings")?;
            settings::get_scope_settings_path(&folder)
        }
        SettingsLevel::Workspace => {
            let path =
                project_path.ok_or("Project path is required for workspace settings")?;
            settings::get_workspace_settings_path(&path)
        }
    };

    Ok(path.to_string_lossy().to_string())
}
