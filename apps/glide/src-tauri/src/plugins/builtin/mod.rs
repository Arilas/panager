//! Built-in Plugins
//!
//! This module contains plugins that are bundled with the IDE.

pub mod css;
pub mod html;
pub mod json;
pub mod typescript;
pub mod yaml;

use super::host::PluginHost;
use tracing::info;

/// Register all built-in plugins with the host
pub async fn register_builtin_plugins(host: &PluginHost) {
    info!("Registering built-in plugins");

    // TypeScript/JavaScript plugin
    host.register(Box::new(typescript::TypeScriptPlugin::new()))
        .await;

    // JSON plugin
    host.register(Box::new(json::JsonPlugin::new())).await;

    // CSS/SCSS/Less plugin
    host.register(Box::new(css::CssPlugin::new())).await;

    // HTML plugin
    host.register(Box::new(html::HtmlPlugin::new())).await;

    // YAML plugin
    host.register(Box::new(yaml::YamlPlugin::new())).await;
}

/// Activate all built-in plugins that should start automatically
pub async fn activate_default_plugins(host: &PluginHost) {
    info!("Activating default plugins");

    let plugins = [
        "panager.typescript",
        "panager.json",
        "panager.css",
        "panager.html",
        "panager.yaml",
    ];

    for plugin_id in plugins {
        if let Err(e) = host.activate(plugin_id).await {
            tracing::warn!("Failed to activate {} plugin: {}", plugin_id, e);
        }
    }
}
