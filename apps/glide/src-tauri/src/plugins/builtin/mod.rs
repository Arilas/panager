//! Built-in Plugins
//!
//! This module contains plugins that are bundled with the IDE.

pub mod biome;
pub mod css;
pub mod emmet;
pub mod eslint;
pub mod html;
pub mod json;
pub mod oxlint;
pub mod prettier;
pub mod tailwindcss;
pub mod typescript;
pub mod yaml;

use super::host::PluginHost;
use tracing::info;

/// Register all built-in plugins with the host
pub async fn register_builtin_plugins(host: &PluginHost) {
    info!("Registering built-in plugins");

    // TypeScript/JavaScript plugin (core language support)
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

    // Tailwind CSS plugin (auto-detected based on project config)
    host.register(Box::new(tailwindcss::TailwindCssPlugin::new()))
        .await;

    // ESLint plugin (auto-detected based on eslint config)
    host.register(Box::new(eslint::EslintPlugin::new())).await;

    // Oxlint plugin (auto-detected based on oxlint config)
    host.register(Box::new(oxlint::OxlintPlugin::new())).await;

    // Prettier plugin (auto-detected based on prettier config)
    host.register(Box::new(prettier::PrettierPlugin::new()))
        .await;

    // Biome plugin (auto-detected based on biome.json)
    host.register(Box::new(biome::BiomePlugin::new())).await;

    // Emmet plugin (always active for HTML/JSX)
    host.register(Box::new(emmet::EmmetPlugin::new())).await;
}

/// Activate all built-in plugins that should start automatically
pub async fn activate_default_plugins(host: &PluginHost) {
    info!("Activating default plugins");

    // Core language support plugins (always active)
    let core_plugins = [
        "panager.typescript",
        "panager.json",
        "panager.css",
        "panager.html",
        "panager.yaml",
        "panager.emmet", // Emmet is always useful for web development
    ];

    for plugin_id in core_plugins {
        if let Err(e) = host.activate(plugin_id).await {
            tracing::warn!("Failed to activate {} plugin: {}", plugin_id, e);
        }
    }

    // Conditional plugins (auto-detect based on project configuration)
    // These plugins check for their config files before actually starting their LSP
    let conditional_plugins = [
        "panager.tailwindcss", // Activates if tailwind is in package.json/lock files
        "panager.eslint",      // Activates if .eslintrc.* or eslint.config.* exists
        "panager.oxlint",      // Activates if oxlintrc.json exists or oxlint in package.json
        "panager.prettier",    // Activates if .prettierrc.* exists
        "panager.biome",       // Activates if biome.json exists
    ];

    for plugin_id in conditional_plugins {
        if let Err(e) = host.activate(plugin_id).await {
            tracing::warn!("Failed to activate {} plugin: {}", plugin_id, e);
        }
    }
}
