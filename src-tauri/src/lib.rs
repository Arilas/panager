mod commands;
mod db;
mod services;

use db::Database;
use services::cleanup::CleanupServiceState;
use services::folder_scanner::FolderScanServiceState;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database
            let database = Database::new().expect("Failed to initialize database");
            app.manage(database);

            // Initialize cleanup service state
            app.manage(CleanupServiceState::default());

            // Initialize folder scan service state
            app.manage(FolderScanServiceState::default());

            // Sync editors on startup
            if app.try_state::<Database>().is_some() {
                let _ = commands::editors::detect_editors();
            }

            // Validate git config caches on startup
            if let Some(db) = app.try_state::<Database>() {
                let _ = services::git_config::validate_git_config_caches(&db);
            }

            // Apply vibrancy effect on macOS
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                if let Some(window) = app.get_webview_window("main") {
                    apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None)
                        .expect("Failed to apply vibrancy");

                    // Defer Liquid Glass initialization until WebView is ready
                    // The WebView is not fully initialized during setup, so we spawn
                    // a task that waits briefly then enables Liquid Glass
                    let window_clone = window.clone();
                    std::thread::spawn(move || {
                        // Wait for WebView to be fully initialized
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        if let Err(e) = commands::liquid_glass::enable_liquid_glass_for_window(&window_clone) {
                            eprintln!("Warning: Failed to enable Liquid Glass: {}", e);
                        }
                    });
                }
            }

            // Start cleanup service
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                services::cleanup::start_cleanup_service(app_handle).await;
            });

            // Start folder scan service
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                services::folder_scanner::start_folder_scan_service(app_handle).await;
            });

            // Setup application menu bar (macOS)
            #[cfg(target_os = "macos")]
            {
                // Panager menu
                let about_item =
                    MenuItem::with_id(app, "about", "About Panager", true, None::<&str>)?;
                let separator_about = PredefinedMenuItem::separator(app)?;
                let settings_item =
                    MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
                let separator = PredefinedMenuItem::separator(app)?;
                let hide = PredefinedMenuItem::hide(app, Some("Hide Panager"))?;
                let hide_others = PredefinedMenuItem::hide_others(app, Some("Hide Others"))?;
                let show_all = PredefinedMenuItem::show_all(app, Some("Show All"))?;
                let separator2 = PredefinedMenuItem::separator(app)?;
                let quit = PredefinedMenuItem::quit(app, Some("Quit Panager"))?;

                let app_menu = Submenu::with_items(
                    app,
                    "Panager",
                    true,
                    &[
                        &about_item,
                        &separator_about,
                        &settings_item,
                        &separator,
                        &hide,
                        &hide_others,
                        &show_all,
                        &separator2,
                        &quit,
                    ],
                )?;

                // Edit menu
                let undo = PredefinedMenuItem::undo(app, None)?;
                let redo = PredefinedMenuItem::redo(app, None)?;
                let cut = PredefinedMenuItem::cut(app, None)?;
                let copy = PredefinedMenuItem::copy(app, None)?;
                let paste = PredefinedMenuItem::paste(app, None)?;
                let select_all = PredefinedMenuItem::select_all(app, None)?;
                let edit_separator = PredefinedMenuItem::separator(app)?;

                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &undo,
                        &redo,
                        &edit_separator,
                        &cut,
                        &copy,
                        &paste,
                        &select_all,
                    ],
                )?;

                // View menu
                let toggle_sidebar = MenuItem::with_id(
                    app,
                    "toggle_sidebar",
                    "Toggle Sidebar",
                    true,
                    Some("CmdOrCtrl+B"),
                )?;
                let view_separator = PredefinedMenuItem::separator(app)?;
                let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;

                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[&toggle_sidebar, &view_separator, &fullscreen],
                )?;

                // Window menu
                let minimize = PredefinedMenuItem::minimize(app, None)?;
                let window_separator = PredefinedMenuItem::separator(app)?;
                let close_window =
                    PredefinedMenuItem::close_window(app, Some("Close Window"))?;

                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[&minimize, &window_separator, &close_window],
                )?;

                let menu =
                    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])?;

                app.set_menu(menu)?;

                app.on_menu_event(|app, event| match event.id.as_ref() {
                    "about" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-about", ());
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-settings", ());
                        }
                    }
                    "toggle_sidebar" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-toggle-sidebar", ());
                        }
                    }
                    _ => {}
                });
            }

            // Setup system tray
            let quit_item = MenuItem::with_id(app, "quit", "Quit Panager", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Show Panager", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Register global shortcut (Cmd+Shift+O)
            let shortcut: Shortcut = "CommandOrControl+Shift+O".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, _event| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            })?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // On macOS, hide the window instead of closing to keep the app running
            // This allows the global shortcut to still work
            #[cfg(target_os = "macos")]
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
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
            commands::temp::get_temp_projects_path,
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
            services::git_config::read_git_include_ifs,
            services::git_config::get_scope_git_identity,
            services::git_config::verify_project_git_config,
            services::git_config::fix_project_git_config,
            services::git_config::create_git_include_if,
            services::git_config::create_scope_git_config_file,
            services::git_config::refresh_scope_git_identity,
            services::git_config::discover_scope_git_config,
            // SSH Config
            services::ssh_config::read_ssh_aliases,
            services::ssh_config::get_ssh_alias_details,
            services::ssh_config::create_ssh_alias,
            services::ssh_config::verify_project_ssh_remote,
            services::ssh_config::fix_project_ssh_remote,
            // Git URL
            services::git_url::parse_git_url,
            // Liquid Glass
            commands::liquid_glass::is_liquid_glass_available,
            commands::liquid_glass::get_macos_version,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Handle dock click on macOS to reopen the window
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
