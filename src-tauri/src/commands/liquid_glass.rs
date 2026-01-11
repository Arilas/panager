//! Liquid Glass module for enabling Apple's Liquid Glass CSS properties
//!
//! This module provides access to private WebKit APIs that enable the
//! `-apple-*` CSS properties used for Liquid Glass design effects.
//!
//! ## Version Requirements
//! - **Backdrop filter**: macOS 10.14+ (Mojave)
//! - **Full Liquid Glass**: macOS 26+ (when available)
//!
//! All private API calls are guarded with `respondsToSelector:` checks
//! to gracefully degrade on unsupported macOS versions.

#[cfg(target_os = "macos")]
use objc2::runtime::{AnyObject, Bool, Sel};
#[cfg(target_os = "macos")]
use objc2::{sel, msg_send, class};
#[cfg(target_os = "macos")]
use once_cell::sync::Lazy;

/// Minimum macOS version for backdrop filter support (10.14 Mojave)
#[cfg(target_os = "macos")]
const MIN_MACOS_BACKDROP: (u32, u32) = (10, 14);

/// Minimum macOS version for full Liquid Glass support (26.0)
#[cfg(target_os = "macos")]
const MIN_MACOS_LIQUID_GLASS: (u32, u32) = (26, 0);

/// Cached macOS version to avoid repeated system calls
#[cfg(target_os = "macos")]
static MACOS_VERSION: Lazy<Option<(u32, u32)>> = Lazy::new(parse_macos_version);

/// Parse macOS version from sw_vers command
#[cfg(target_os = "macos")]
fn parse_macos_version() -> Option<(u32, u32)> {
    use std::process::Command;

    let output = Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()?;

    let version_str = String::from_utf8(output.stdout).ok()?;
    let parts: Vec<&str> = version_str.trim().split('.').collect();

    let major: u32 = parts.first()?.parse().ok()?;
    let minor: u32 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);

    Some((major, minor))
}

/// Check if the current macOS version meets the minimum requirement
#[cfg(target_os = "macos")]
fn check_macos_version(min_version: (u32, u32)) -> bool {
    match *MACOS_VERSION {
        Some((major, minor)) => {
            (major, minor) >= min_version
        }
        None => false, // Unable to determine version, be conservative
    }
}

/// Check if backdrop filter is supported on this macOS version
#[cfg(target_os = "macos")]
pub fn is_backdrop_filter_supported() -> bool {
    check_macos_version(MIN_MACOS_BACKDROP)
}

/// Check if full Liquid Glass effects are supported on this macOS version
#[cfg(target_os = "macos")]
pub fn is_liquid_glass_supported() -> bool {
    check_macos_version(MIN_MACOS_LIQUID_GLASS)
}

/// Enables Liquid Glass CSS properties on the WebView
///
/// This function accesses private WebKit APIs to enable:
/// - `-apple-color-filter`
/// - `-apple-visual-effect`
/// - `-apple-backdrop-filter`
/// - Other Apple-specific CSS properties for glass effects
///
/// ## Safety
/// This function uses private WebKit APIs. All calls are guarded with:
/// 1. macOS version checks (10.14+ for backdrop, 26+ for full Liquid Glass)
/// 2. `respondsToSelector:` checks to avoid crashes on unsupported versions
#[cfg(target_os = "macos")]
pub fn enable_liquid_glass_for_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    // Check minimum macOS version for any backdrop filter support
    if !is_backdrop_filter_supported() {
        tracing::warn!(
            "macOS version {:?} does not support backdrop filter (requires 10.14+)",
            *MACOS_VERSION
        );
        return Ok(()); // Gracefully skip on older versions
    }

    // Log if full Liquid Glass is available
    if is_liquid_glass_supported() {
        tracing::info!("Full Liquid Glass support detected (macOS 26+)");
    } else {
        tracing::info!("Backdrop filter available; full Liquid Glass requires macOS 26+");
    }

    // Get the NSWindow from the Tauri window
    // In Tauri 2.x, ns_window() is directly on WebviewWindow
    let ns_window = window.ns_window().map_err(|e| format!("Failed to get NSWindow: {:?}", e))?;

    unsafe {
        let ns_window = ns_window as *mut AnyObject;

        // Get the content view
        let content_view: *mut AnyObject = msg_send![ns_window, contentView];
        if content_view.is_null() {
            return Err("Failed to get content view".to_string());
        }

        // Find the WKWebView in the view hierarchy
        let wk_webview = find_wkwebview(content_view)?;

        // CRITICAL: Enable useSystemAppearance on WKWebView
        // This is the key setting that enables -apple-visual-effect CSS property
        // Without this, Liquid Glass CSS properties will not work
        // Reference: https://www.mail-archive.com/webkit-changes@lists.webkit.org/msg224242.html
        let sel = sel!(_setUseSystemAppearance:);
        if responds_to_selector(wk_webview, sel) {
            let _: () = msg_send![wk_webview, _setUseSystemAppearance: Bool::YES];
            eprintln!("[Liquid Glass] Enabled _setUseSystemAppearance on WKWebView");
        } else {
            eprintln!("[Liquid Glass] WKWebView does not respond to _setUseSystemAppearance:");
        }

        // Get the WKWebViewConfiguration
        let configuration: *mut AnyObject = msg_send![wk_webview, configuration];
        if configuration.is_null() {
            return Err("Failed to get WKWebViewConfiguration".to_string());
        }

        // Get the WKPreferences
        let preferences: *mut AnyObject = msg_send![configuration, preferences];
        if preferences.is_null() {
            return Err("Failed to get WKPreferences".to_string());
        }

        // Enable WebKit experimental features for Liquid Glass
        // All private API calls are guarded with respondsToSelector checks
        // to avoid crashes on macOS versions that don't support them

        // Also set useSystemAppearance on WKPreferences (belt and suspenders approach)
        // Recent WebKit changes made this a unified preference that can be set on either
        let sel = sel!(_setUseSystemAppearance:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setUseSystemAppearance: Bool::YES];
            eprintln!("[Liquid Glass] Enabled _setUseSystemAppearance on WKPreferences");
        } else {
            eprintln!("[Liquid Glass] WKPreferences does not respond to _setUseSystemAppearance:");
        }

        // Enable developer extras (required for some private APIs)
        let sel = sel!(_setDeveloperExtrasEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setDeveloperExtrasEnabled: Bool::YES];
        }

        // Enable backdrop filter (for -webkit-backdrop-filter and -apple-backdrop-filter)
        let sel = sel!(_setBackdropFilterEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setBackdropFilterEnabled: Bool::YES];
        }

        // Enable color filter
        let sel = sel!(_setColorFilterEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setColorFilterEnabled: Bool::YES];
        }

        // Enable visual effects
        let sel = sel!(_setVisualViewportEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setVisualViewportEnabled: Bool::YES];
        }

        // Enable GPU acceleration for effects
        let sel = sel!(_setAcceleratedDrawingEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setAcceleratedDrawingEnabled: Bool::YES];
        }

        // Enable subpixel CSS animation
        let sel = sel!(_setSubpixelCSSOMElementMetricsEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setSubpixelCSSOMElementMetricsEnabled: Bool::YES];
        }

        // Enable async frame scrolling (smooth scrolling with effects)
        let sel = sel!(_setAsyncFrameScrollingEnabled:);
        if responds_to_selector(preferences, sel) {
            let _: () = msg_send![preferences, _setAsyncFrameScrollingEnabled: Bool::YES];
        }

        // Try to enable Apple-specific visual effect APIs (macOS 26+ Liquid Glass)
        // These may not be available on all macOS versions
        enable_liquid_glass_private_apis(preferences);

        Ok(())
    }
}

/// Attempts to enable Liquid Glass-specific private APIs
/// These are available on macOS 26+ and enable the full Liquid Glass effect
#[cfg(target_os = "macos")]
unsafe fn enable_liquid_glass_private_apis(preferences: *mut AnyObject) {
    // Try to enable the Apple visual effect property
    // This enables -apple-visual-effect CSS property
    let sel_visual_effect = sel!(_setAppleVisualEffectEnabled:);
    if responds_to_selector(preferences, sel_visual_effect) {
        let _: () = msg_send![preferences, _setAppleVisualEffectEnabled: Bool::YES];
    }

    // Try to enable Apple color filter
    // This enables -apple-color-filter CSS property for glass tinting
    let sel_color_filter = sel!(_setAppleColorFilterEnabled:);
    if responds_to_selector(preferences, sel_color_filter) {
        let _: () = msg_send![preferences, _setAppleColorFilterEnabled: Bool::YES];
    }

    // Try to enable Apple backdrop filter
    let sel_backdrop = sel!(_setAppleBackdropFilterEnabled:);
    if responds_to_selector(preferences, sel_backdrop) {
        let _: () = msg_send![preferences, _setAppleBackdropFilterEnabled: Bool::YES];
    }

    // Enable WebGL 2.0 for advanced effects
    let sel_webgl2 = sel!(_setWebGL2Enabled:);
    if responds_to_selector(preferences, sel_webgl2) {
        let _: () = msg_send![preferences, _setWebGL2Enabled: Bool::YES];
    }

    // Enable Spring animation timing function
    let sel_spring = sel!(_setSpringTimingFunctionEnabled:);
    if responds_to_selector(preferences, sel_spring) {
        let _: () = msg_send![preferences, _setSpringTimingFunctionEnabled: Bool::YES];
    }
}

/// Checks if an object responds to a selector
#[cfg(target_os = "macos")]
unsafe fn responds_to_selector(obj: *mut AnyObject, sel: Sel) -> bool {
    let responds: Bool = msg_send![obj, respondsToSelector: sel];
    responds.as_bool()
}

/// Recursively finds the WKWebView in the view hierarchy
#[cfg(target_os = "macos")]
unsafe fn find_wkwebview(view: *mut AnyObject) -> Result<*mut AnyObject, String> {
    // Check if this view is a WKWebView
    let wkwebview_class = class!(WKWebView);
    let is_kind: Bool = msg_send![view, isKindOfClass: wkwebview_class];

    if is_kind.as_bool() {
        return Ok(view);
    }

    // Get subviews and search recursively
    let subviews: *mut AnyObject = msg_send![view, subviews];
    if subviews.is_null() {
        return Err("No WKWebView found".to_string());
    }

    let count: usize = msg_send![subviews, count];

    for i in 0..count {
        let subview: *mut AnyObject = msg_send![subviews, objectAtIndex: i];
        if let Ok(found) = find_wkwebview(subview) {
            return Ok(found);
        }
    }

    Err("No WKWebView found in view hierarchy".to_string())
}

/// Non-macOS stub
#[cfg(not(target_os = "macos"))]
pub fn enable_liquid_glass_for_window(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Ok(()) // No-op on non-macOS platforms
}

/// Tauri command to check if Liquid Glass is available
///
/// Returns true if the system supports at least backdrop filter (macOS 10.14+).
/// For full Liquid Glass effects, use `is_full_liquid_glass_available()`.
#[tauri::command]
#[specta::specta]
pub fn is_liquid_glass_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        is_backdrop_filter_supported()
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
        is_liquid_glass_supported()
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
        use std::process::Command;

        let output = Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()?;

        String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}
