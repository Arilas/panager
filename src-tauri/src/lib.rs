mod commands;
mod db;
mod services;

use db::Database;
use services::cleanup::CleanupServiceState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize database
            let database = Database::new().expect("Failed to initialize database");
            app.manage(database);

            // Initialize cleanup service state
            app.manage(CleanupServiceState::default());

            // Sync editors on startup
            if app.try_state::<Database>().is_some() {
                let _ = commands::editors::detect_editors();
            }

            // Apply vibrancy effect on macOS
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                if let Some(window) = app.get_webview_window("main") {
                    apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None)
                        .expect("Failed to apply vibrancy");
                }
            }

            // Start cleanup service
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                services::cleanup::start_cleanup_service(app_handle).await;
            });

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

            Ok(())
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
            commands::projects::update_project_last_opened,
            commands::projects::move_project_to_scope,
            commands::projects::add_project_tag,
            commands::projects::remove_project_tag,
            commands::projects::scan_folder_for_projects,
            // Git
            commands::git::get_git_status,
            commands::git::refresh_git_status,
            commands::git::git_pull,
            commands::git::git_push,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
