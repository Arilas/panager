//! Panager - A cross-platform project manager
//!
//! This is the main library entry point that sets up and runs the Tauri application.

pub mod acp;
mod app;
mod commands;
pub mod db;
pub mod error;
pub mod events;
pub mod git;
pub mod ide;
pub mod logging;
mod platform;
pub mod plugins;
pub mod services;
pub mod ssh;
pub mod utils;

use app::{handle_run_event, handle_window_event, register_plugins};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    logging::init();
    tracing::info!("Starting Panager application");

    register_plugins(tauri::Builder::default())
        .setup(|app| {
            // Initialize state
            app::init_state(app)?;
            
            // Run startup tasks
            app::run_startup_tasks(app);
            
            // Start background services
            app::start_background_services(app);

            // Platform-specific setup (tray, shortcuts, vibrancy, menus)
            platform::setup(app)?;

            Ok(())
        })
        .on_window_event(handle_window_event)
        .invoke_handler(tauri::generate_handler![
            // Scopes
            commands::scopes::get_scopes,
            commands::scopes::create_scope,
            commands::scopes::update_scope,
            commands::scopes::delete_scope,
            commands::scopes::reorder_scopes,
            commands::scopes::create_scope_link,
            commands::scopes::delete_scope_link,
            // Projects
            commands::projects::get_projects,
            commands::projects::get_all_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::delete_project_with_folder,
            commands::projects::update_project_last_opened,
            commands::projects::move_project_to_scope,
            commands::projects::move_project_to_scope_with_folder,
            commands::projects::add_project_tag,
            commands::projects::remove_project_tag,
            commands::projects::scan_folder_for_projects,
            // Project Links
            commands::projects::create_project_link,
            commands::projects::delete_project_link,
            commands::projects::get_project_links,
            // Project Groups
            commands::projects::create_project_group,
            commands::projects::update_project_group,
            commands::projects::delete_project_group,
            commands::projects::get_project_groups,
            commands::projects::assign_project_to_group,
            // Project Commands
            commands::projects::create_project_command,
            commands::projects::update_project_command,
            commands::projects::delete_project_command,
            commands::projects::get_project_commands,
            commands::projects::execute_project_command,
            // Project Metadata
            commands::projects::update_project_notes,
            commands::projects::update_project_description,
            commands::projects::pin_project,
            commands::projects::unpin_project,
            // Project Statistics
            commands::projects::get_project_statistics,
            // Git
            commands::git::get_git_status,
            commands::git::refresh_git_status,
            commands::git::git_pull,
            commands::git::git_push,
            commands::git::get_git_branches,
            commands::git::get_git_config,
            commands::git::git_gc,
            commands::git::git_fetch,
            commands::git::check_folder_exists,
            commands::git::clone_repository,
            // Editors
            commands::editors::detect_editors,
            commands::editors::sync_editors,
            commands::editors::get_editors,
            commands::editors::add_editor,
            commands::editors::open_in_editor,
            commands::editors::find_workspace_files,
            // Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            // Temp Projects
            commands::temp::create_temp_project,
            // Cleanup Service
            services::cleanup::cleanup_temp_projects_now,
            services::cleanup::get_cleanup_candidates,
            // Folder Scanner
            services::folder_scanner::scan_scope_folder,
            services::folder_scanner::move_project_to_scope_folder,
            // Git Config
            git::config::read_git_include_ifs,
            git::config::get_scope_git_identity,
            git::config::create_git_include_if,
            git::config::create_scope_git_config_file,
            git::config::refresh_scope_git_identity,
            git::config::discover_scope_git_config,
            // SSH Config
            ssh::config::read_ssh_aliases,
            ssh::config::get_ssh_alias_details,
            ssh::config::create_ssh_alias,
            // Git URL
            git::url::parse_git_url,
            // Liquid Glass
            commands::liquid_glass::is_liquid_glass_available,
            commands::liquid_glass::is_full_liquid_glass_available,
            commands::liquid_glass::get_macos_version,
            // Diagnostics
            services::diagnostics::get_scope_diagnostics,
            services::diagnostics::get_diagnostics_summaries,
            services::diagnostics::get_scope_diagnostics_summary,
            services::diagnostics::scan_scope_diagnostics,
            services::diagnostics::dismiss_diagnostic,
            services::diagnostics::undismiss_diagnostic,
            services::diagnostics::disable_diagnostic_rule,
            services::diagnostics::enable_diagnostic_rule,
            services::diagnostics::get_disabled_diagnostic_rules,
            services::diagnostics::get_diagnostic_rule_metadata,
            services::diagnostics::fix_diagnostic_issue,
            // Terminal
            commands::terminal::open_terminal,
            // Terminals
            commands::terminals::detect_terminals,
            commands::terminals::sync_terminals,
            commands::terminals::get_terminals,
            // IDE
            ide::commands::ide_open_window,
            ide::commands::ide_close_window,
            ide::commands::ide_read_directory,
            ide::commands::ide_read_file,
            ide::commands::ide_get_file_language,
            ide::commands::ide_get_git_changes,
            ide::commands::ide_get_file_diff,
            ide::commands::ide_get_git_branch,
            ide::commands::ide_stage_file,
            ide::commands::ide_unstage_file,
            ide::commands::ide_discard_changes,
            ide::commands::ide_search_file_names,
            ide::commands::ide_search_files,
            ide::commands::ide_start_watcher,
            ide::commands::ide_stop_watcher,
            // IDE - File write operations
            ide::commands::ide_write_file,
            ide::commands::ide_create_file,
            ide::commands::ide_delete_file,
            ide::commands::ide_rename_file,
            // IDE - Plugin notifications (for LSP/plugins)
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
            // IDE - Git commands (extended)
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
            // IDE - Settings commands
            ide::commands::ide_load_settings,
            ide::commands::ide_load_settings_for_level,
            ide::commands::ide_get_settings_for_level,
            ide::commands::ide_update_setting,
            ide::commands::ide_delete_setting,
            ide::commands::ide_get_formatter_presets,
            ide::commands::ide_get_settings_path,
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
        .run(handle_run_event);
}
