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

use ide::commands::session::get_restorable_windows;
use ide::commands::window::{create_window, register_window, PERMISSIVE_CSP, SHOULD_SPAWN_WELCOME};
use plugins::host::PluginHost;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Manager, RunEvent, TitleBarStyle, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Run the application with optional project context from CLI
/// If project is None, tries to restore previous session or shows welcome screen
pub fn run_with_project(project: Option<(&str, &str, &str)>) {
    // Initialize logging
    logging::init();

    // Convert project to owned data for the closure
    let project_owned = project.map(|(id, path, name)| {
        (id.to_string(), path.to_string(), name.to_string())
    });

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

            // Initialize ACP state (wrapped in Arc for command handlers)
            let acp_state = Arc::new(acp::AcpState::new());
            app.manage(acp_state);

            // ChatDb is initialized lazily when project path is known
            // The ACP commands will manage this per-project

            // Create the application menu
            let app_handle = app.handle();
            let menu = create_app_menu(app_handle)?;
            app.set_menu(menu)?;

            // Determine what windows to create
            if let Some((project_id, project_path, project_name)) = &project_owned {
                // CLI specified a project - open only that project (no session restore)
                tracing::info!("Starting Glide with CLI project: {}", project_name);
                // Clear session since we're starting fresh with a CLI project
                let _ = ide::commands::session::ide_clear_session();
                create_main_window(app, Some((project_id, project_path, project_name)))?;
            } else {
                // No CLI project - try to restore previous session
                match get_restorable_windows() {
                    Ok(windows) if !windows.is_empty() => {
                        tracing::info!("Restoring {} window(s) from previous session", windows.len());

                        // Clear old session data - new windows will save their state with new labels
                        let _ = ide::commands::session::ide_clear_session();

                        for (i, window_state) in windows.iter().enumerate() {
                            if i == 0 {
                                // First window uses "main" label for compatibility
                                create_main_window_with_geometry(
                                    app,
                                    Some((
                                        &window_state.project_id,
                                        &window_state.project_path,
                                        &window_state.project_name,
                                    )),
                                    &window_state.geometry,
                                )?;
                            } else {
                                // Additional windows use dynamic labels
                                let _ = create_window(
                                    app.handle(),
                                    Some((
                                        &window_state.project_id,
                                        &window_state.project_path,
                                        &window_state.project_name,
                                    )),
                                    Some(&window_state.geometry),
                                );
                            }
                        }
                    }
                    _ => {
                        // No session to restore - show welcome screen
                        tracing::info!("No previous session, showing welcome screen");
                        create_main_window(app, None)?;
                    }
                }
            }

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
            // IDE - Window management
            ide::commands::ide_open_new_window,
            ide::commands::ide_open_window,
            ide::commands::ide_close_window,
            ide::commands::ide_window_will_close,
            // IDE - Session management
            ide::commands::ide_load_session,
            ide::commands::ide_save_window_state,
            ide::commands::ide_remove_window_state,
            ide::commands::ide_update_window_geometry,
            ide::commands::ide_clear_session,
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
            // ACP - Chat Database
            acp::commands::acp_list_sessions,
            acp::commands::acp_load_session,
            acp::commands::acp_delete_session,
            acp::commands::acp_update_session_name,
            // IDE - Tab management
            ide::commands::ide_get_tab_groups,
            ide::commands::ide_create_tab_group,
            ide::commands::ide_delete_tab_group,
            ide::commands::ide_set_active_group,
            ide::commands::ide_reorder_groups,
            ide::commands::ide_get_tabs,
            ide::commands::ide_get_all_tabs,
            ide::commands::ide_save_tab,
            ide::commands::ide_update_tab_url,
            ide::commands::ide_delete_tab,
            ide::commands::ide_set_active_tab,
            ide::commands::ide_reorder_tabs,
            ide::commands::ide_move_tab_to_group,
            ide::commands::ide_update_tab_session,
            ide::commands::ide_set_tab_pinned,
            ide::commands::ide_convert_preview_to_permanent,
            ide::commands::ide_delete_preview_tabs,
            ide::commands::ide_clear_all_tabs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle menu events
            if let RunEvent::MenuEvent(menu_event) = &event {
                match menu_event.id().0.as_str() {
                    "new_window" => {
                        tracing::info!("Menu: New Window");
                        let _ = create_window(app_handle, None, None);
                    }
                    "close_window" => {
                        tracing::info!("Menu: Close Window");
                        // Get all windows and close the first one (focused behavior varies by platform)
                        let windows = app_handle.webview_windows();
                        if let Some((_, window)) = windows.into_iter().next() {
                            let _ = window.close();
                        }
                    }
                    _ => {}
                }
            }

            // Handle window lifecycle - spawn welcome window if last project window was closed
            if let RunEvent::WindowEvent {
                event: WindowEvent::Destroyed,
                ..
            } = &event
            {
                // Check if all windows are closed
                if app_handle.webview_windows().is_empty() {
                    // Check if we should spawn a new welcome window
                    if SHOULD_SPAWN_WELCOME.load(Ordering::SeqCst) {
                        tracing::info!(
                            "Last project window closed, spawning new welcome window"
                        );
                        SHOULD_SPAWN_WELCOME.store(false, Ordering::SeqCst);
                        let _ = create_window(app_handle, None, None);
                    } else {
                        tracing::info!("Welcome window closed, allowing app to exit");
                        // App will exit naturally when no windows remain
                    }
                }
            }
        });
}

/// Creates the application menu
fn create_app_menu(
    app: &tauri::AppHandle,
) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // App menu (macOS: shows as "Glide" in menu bar)
    let app_menu = SubmenuBuilder::new(app, "Glide")
        .item(&PredefinedMenuItem::about(app, Some("About Glide"), None)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // File menu
    let new_window = MenuItemBuilder::with_id("new_window", "New Window")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let close_window = MenuItemBuilder::with_id("close_window", "Close Window")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_window)
        .separator()
        .item(&close_window)
        .build()?;

    // Edit menu with standard items
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // Window menu
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    // Build the full menu
    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .build()?;

    Ok(menu)
}

/// Creates the main window with optional project context
fn create_main_window(
    app: &tauri::App,
    project: Option<(&str, &str, &str)>,
) -> Result<(), Box<dyn std::error::Error>> {
    let default_geometry = ide::commands::session::WindowGeometry::default();
    create_main_window_with_geometry(app, project, &default_geometry)
}

/// Creates the main window with optional project context and specific geometry
fn create_main_window_with_geometry(
    app: &tauri::App,
    project: Option<(&str, &str, &str)>,
    geometry: &ide::commands::session::WindowGeometry,
) -> Result<(), Box<dyn std::error::Error>> {
    // Build URL based on whether we have a project
    // - Project windows use index.html with URL params
    // - Welcome windows use welcome.html (separate lightweight entry)
    let (url, window_title, project_path) = match project {
        Some((project_id, project_path, project_name)) => {
            let encoded_path = urlencoding::encode(project_path);
            let encoded_name = urlencoding::encode(project_name);
            let url = format!(
                "index.html?projectId={}&projectPath={}&projectName={}",
                project_id, encoded_path, encoded_name
            );
            (url, project_name.to_string(), Some(project_path.to_string()))
        }
        None => ("welcome.html".to_string(), "Glide".to_string(), None),
    };

    let webview_url = WebviewUrl::App(url.into());
    let builder = WebviewWindowBuilder::new(app, "main", webview_url)
        .title(&window_title)
        .inner_size(geometry.width, geometry.height)
        .min_inner_size(800.0, 600.0)
        .transparent(true)
        .decorations(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .position(geometry.x, geometry.y)
        // Set CSP to allow Monaco Editor workers (blob: URLs) and eval
        .on_web_resource_request(|_request, response| {
            response.headers_mut().insert(
                "Content-Security-Policy",
                PERMISSIVE_CSP.parse().unwrap(),
            );
        });

    let window = builder.build()?;

    // Set maximized state after build if needed
    if geometry.is_maximized {
        let _ = window.maximize();
    }

    // Register window in the registry
    register_window("main", project_path.as_deref());

    Ok(())
}
