//! Panager - A cross-platform project manager
//!
//! This is the main library entry point that sets up and runs the Tauri application.

mod app;
mod commands;
pub mod db;
pub mod error;
pub mod git;
pub mod logging;
mod platform;
mod services;
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
            // Git
            commands::git::get_git_status,
            commands::git::refresh_git_status,
            commands::git::git_pull,
            commands::git::git_push,
            commands::git::check_folder_exists,
            commands::git::clone_repository,
            // Editors
            commands::editors::detect_editors,
            commands::editors::sync_editors,
            commands::editors::get_editors,
            commands::editors::add_editor,
            commands::editors::delete_editor,
            commands::editors::open_in_editor,
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
            services::folder_scanner::get_projects_outside_folder,
            services::folder_scanner::ignore_folder_warning,
            services::folder_scanner::remove_ignored_warning,
            services::folder_scanner::get_ignored_warnings,
            services::folder_scanner::scan_scope_folder,
            services::folder_scanner::move_project_to_scope_folder,
            // Git Config
            git::config::read_git_include_ifs,
            git::config::get_scope_git_identity,
            git::config::verify_project_git_config,
            git::config::fix_project_git_config,
            git::config::create_git_include_if,
            git::config::create_scope_git_config_file,
            git::config::refresh_scope_git_identity,
            git::config::discover_scope_git_config,
            // SSH Config
            ssh::config::read_ssh_aliases,
            ssh::config::get_ssh_alias_details,
            ssh::config::create_ssh_alias,
            ssh::config::verify_project_ssh_remote,
            ssh::config::fix_project_ssh_remote,
            // Git URL
            git::url::parse_git_url,
            // Liquid Glass
            commands::liquid_glass::is_liquid_glass_available,
            commands::liquid_glass::is_full_liquid_glass_available,
            commands::liquid_glass::get_macos_version,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(handle_run_event);
}
