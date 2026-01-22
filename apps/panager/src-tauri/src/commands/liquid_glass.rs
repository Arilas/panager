//! Liquid Glass Tauri commands
//!
//! Thin wrappers around platform-specific Liquid Glass implementations.
//! The actual implementation lives in `platform/macos/liquid_glass.rs`.

/// Tauri command to check if Liquid Glass is available
///
/// Returns true if the system supports at least backdrop filter (macOS 10.14+).
/// For full Liquid Glass effects, use `is_full_liquid_glass_available()`.
#[tauri::command]
#[specta::specta]
pub fn is_liquid_glass_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::platform::macos::liquid_glass::is_backdrop_filter_supported()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// Tauri command to check if full Liquid Glass is available (macOS 26+)
#[tauri::command]
#[specta::specta]
pub fn is_full_liquid_glass_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::platform::macos::liquid_glass::is_liquid_glass_supported()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// Tauri command to get the macOS version
#[tauri::command]
#[specta::specta]
pub fn get_macos_version() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        crate::platform::macos::liquid_glass::get_macos_version_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

/// Enable Liquid Glass for a window (called internally, not exposed as command)
#[cfg(target_os = "macos")]
pub fn enable_liquid_glass_for_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    crate::platform::macos::liquid_glass::enable_liquid_glass_for_window(window)
}

/// Non-macOS stub
#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
pub fn enable_liquid_glass_for_window(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Ok(())
}
