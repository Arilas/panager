//! Glide - AI-Powered Code Editor
//!
//! This is the main library entry point that sets up and runs the Tauri application.

pub mod acp;
pub mod error;
pub mod git;
pub mod ide;
pub mod logging;
pub mod platform;
pub mod plugins;
pub mod utils;

use plugins::host::PluginHost;
use std::sync::Arc;
use tauri::{Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

/// Run the application with optional project context from CLI
/// If project is None, shows the welcome screen
pub fn run_with_project(project: Option<(&str, &str, &str)>) {
    // Initialize logging
    logging::init();

    // Build URL based on whether we have a project
    let (url, window_title) = match project {
        Some((project_id, project_path, project_name)) => {
            tracing::info!("Starting Glide with project: {}", project_name);
            let encoded_path = urlencoding::encode(project_path);
            let encoded_name = urlencoding::encode(project_name);
            let url = format!(
                "index.html?projectId={}&projectPath={}&projectName={}",
                project_id, encoded_path, encoded_name
            );
            (url, project_name.to_string())
        }
        None => {
            tracing::info!("Starting Glide without project (welcome screen)");
            ("index.html".to_string(), "Glide".to_string())
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Initialize plugin host (uses internal RwLock for synchronization)
            let plugin_host = Arc::new(PluginHost::new());

            // Register and activate builtin plugins (TypeScript LSP, etc.)
            let host_clone = plugin_host.clone();
            tauri::async_runtime::spawn(async move {
                plugins::builtin::register_builtin_plugins(&host_clone).await;
                plugins::builtin::activate_default_plugins(&host_clone).await;
            });

            app.manage(plugin_host);

            // Initialize ACP state
            let acp_state = acp::AcpState::new();
            app.manage(acp_state);

            // ChatDb is initialized lazily when project path is known
            // The ACP commands will manage this per-project

            // Create the main window
            let webview_url = WebviewUrl::App(url.clone().into());
            let _window = WebviewWindowBuilder::new(app, "main", webview_url)
                .title(&window_title)
                .inner_size(1400.0, 900.0)
                .min_inner_size(800.0, 600.0)
                .transparent(true)
                .decorations(true)
                .title_bar_style(TitleBarStyle::Overlay)
                .hidden_title(true)
                .build()?;

            // Platform-specific setup (vibrancy on macOS)
            platform::setup(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // IDE - File operations
            ide::commands::ide_read_directory,
            ide::commands::ide_read_file,
            ide::commands::ide_get_file_language,
            ide::commands::ide_write_file,
            ide::commands::ide_create_file,
            ide::commands::ide_delete_file,
            ide::commands::ide_rename_file,
            ide::commands::ide_create_directory,
            ide::commands::ide_delete_directory,
            ide::commands::ide_copy_path,
            ide::commands::ide_copy_directory,
            ide::commands::ide_path_exists,
            ide::commands::ide_reveal_in_finder,
            // IDE - Git operations
            ide::commands::ide_get_git_changes,
            ide::commands::ide_get_file_diff,
            ide::commands::ide_get_git_branch,
            ide::commands::ide_stage_file,
            ide::commands::ide_unstage_file,
            ide::commands::ide_discard_changes,
            ide::commands::ide_git_commit,
            ide::commands::ide_git_get_staged_summary,
            ide::commands::ide_git_list_branches,
            ide::commands::ide_git_create_branch,
            ide::commands::ide_git_switch_branch,
            ide::commands::ide_git_delete_branch,
            ide::commands::ide_git_check_uncommitted_changes,
            ide::commands::ide_git_stash_save,
            ide::commands::ide_git_stash_list,
            ide::commands::ide_git_stash_pop,
            ide::commands::ide_git_stash_apply,
            ide::commands::ide_git_stash_drop,
            ide::commands::ide_git_blame,
            ide::commands::ide_git_blame_line,
            ide::commands::ide_git_show_head,
            // IDE - Search
            ide::commands::ide_search_file_names,
            ide::commands::ide_search_files,
            // IDE - Watcher
            ide::commands::ide_start_watcher,
            ide::commands::ide_stop_watcher,
            // IDE - Plugin notifications
            ide::commands::ide_notify_file_opened,
            ide::commands::ide_notify_file_changed,
            ide::commands::ide_notify_file_closed,
            ide::commands::ide_notify_project_opened,
            ide::commands::ide_notify_project_closed,
            // IDE - Plugin management
            ide::commands::ide_list_plugins,
            ide::commands::ide_enable_plugin,
            ide::commands::ide_disable_plugin,
            ide::commands::ide_get_plugin,
            // IDE - LSP commands
            ide::commands::ide_lsp_goto_definition,
            ide::commands::ide_lsp_hover,
            ide::commands::ide_lsp_completion,
            ide::commands::ide_lsp_references,
            ide::commands::ide_lsp_rename,
            ide::commands::ide_lsp_code_action,
            ide::commands::ide_lsp_document_symbols,
            ide::commands::ide_lsp_inlay_hints,
            ide::commands::ide_lsp_document_highlight,
            ide::commands::ide_lsp_signature_help,
            ide::commands::ide_lsp_format_document,
            ide::commands::ide_lsp_format_range,
            ide::commands::ide_lsp_format_on_type,
            ide::commands::ide_lsp_type_definition,
            ide::commands::ide_lsp_implementation,
            ide::commands::ide_lsp_folding_range,
            ide::commands::ide_lsp_selection_range,
            ide::commands::ide_lsp_linked_editing_range,
            // IDE - Settings
            ide::commands::ide_load_settings,
            ide::commands::ide_load_settings_for_level,
            ide::commands::ide_get_settings_for_level,
            ide::commands::ide_update_setting,
            ide::commands::ide_delete_setting,
            ide::commands::ide_get_formatter_presets,
            ide::commands::ide_get_settings_path,
            // IDE - Recent Projects
            ide::commands::ide_get_recent_projects,
            ide::commands::ide_add_recent_project,
            ide::commands::ide_remove_recent_project,
            ide::commands::ide_clear_recent_projects,
            // ACP - Agent Client Protocol
            acp::commands::acp_connect,
            acp::commands::acp_disconnect,
            acp::commands::acp_get_status,
            acp::commands::acp_new_session,
            acp::commands::acp_resume_session,
            acp::commands::acp_send_prompt,
            acp::commands::acp_cancel,
            acp::commands::acp_set_mode,
            acp::commands::acp_respond_permission,
            acp::commands::acp_get_current_session,
            // ACP - Chat Database
            acp::commands::acp_list_sessions,
            acp::commands::acp_load_session,
            acp::commands::acp_delete_session,
            acp::commands::acp_update_session_name,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
