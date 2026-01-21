//! Built-in Plugins
//!
//! This module contains plugins that are bundled with the IDE.

pub mod typescript;

use super::host::PluginHost;
use tracing::info;

/// Register all built-in plugins with the host
pub async fn register_builtin_plugins(host: &PluginHost) {
    info!("Registering built-in plugins");

    // TypeScript/JavaScript plugin
    host.register(Box::new(typescript::TypeScriptPlugin::new()))
        .await;

    // Future: Add more built-in plugins here
    // host.register(Box::new(eslint::EslintPlugin::new())).await;
    // host.register(Box::new(prettier::PrettierPlugin::new())).await;
}

/// Activate all built-in plugins that should start automatically
pub async fn activate_default_plugins(host: &PluginHost) {
    info!("Activating default plugins");

    // TypeScript is enabled by default
    if let Err(e) = host.activate("panager.typescript").await {
        tracing::warn!("Failed to activate TypeScript plugin: {}", e);
    }
}
