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

use objc2::runtime::{AnyObject, Bool, Sel};
use objc2::{class, msg_send, sel};

// Re-export capability checks for use by commands
pub use crate::platform::capabilities::macos::{
    get_version_string as get_macos_version_string, is_backdrop_filter_supported,
    is_liquid_glass_supported,
};

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
pub fn enable_liquid_glass_for_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    // Check minimum macOS version for any backdrop filter support
    if !is_backdrop_filter_supported() {
        tracing::warn!(
            "macOS version does not support backdrop filter (requires 10.14+)"
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
    let ns_window = window
        .ns_window()
        .map_err(|e| format!("Failed to get NSWindow: {:?}", e))?;

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
        enable_webkit_features(preferences);

        // Try to enable Apple-specific visual effect APIs (macOS 26+ Liquid Glass)
        enable_liquid_glass_private_apis(preferences);

        Ok(())
    }
}

/// Enable standard WebKit features for glass effects
unsafe fn enable_webkit_features(preferences: *mut AnyObject) {
    // Also set useSystemAppearance on WKPreferences (belt and suspenders approach)
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
}

/// Attempts to enable Liquid Glass-specific private APIs
/// These are available on macOS 26+ and enable the full Liquid Glass effect
unsafe fn enable_liquid_glass_private_apis(preferences: *mut AnyObject) {
    // Try to enable the Apple visual effect property
    let sel_visual_effect = sel!(_setAppleVisualEffectEnabled:);
    if responds_to_selector(preferences, sel_visual_effect) {
        let _: () = msg_send![preferences, _setAppleVisualEffectEnabled: Bool::YES];
    }

    // Try to enable Apple color filter
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
unsafe fn responds_to_selector(obj: *mut AnyObject, sel: Sel) -> bool {
    let responds: Bool = msg_send![obj, respondsToSelector: sel];
    responds.as_bool()
}

/// Recursively finds the WKWebView in the view hierarchy
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
