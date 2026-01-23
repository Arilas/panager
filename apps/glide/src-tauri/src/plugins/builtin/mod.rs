//! Built-in Plugins
//!
//! This module contains plugins that are bundled with the IDE.

pub mod angular;
pub mod astro;
pub mod bash;
pub mod biome;
pub mod css;
pub mod deno;
pub mod dockerfile;
pub mod emmet;
pub mod eslint;
pub mod gopls;
pub mod graphql;
pub mod html;
pub mod json;
pub mod mdx;
pub mod oxfmt;
pub mod oxlint;
pub mod prettier;
pub mod prisma;
pub mod pyright;
pub mod rust_analyzer;
pub mod sql;
pub mod svelte;
pub mod tailwindcss;
pub mod tombi;
pub mod typescript;
pub mod vue;
pub mod yaml;
pub mod zls;

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

    // Oxfmt plugin (fast Prettier-compatible formatter)
    host.register(Box::new(oxfmt::OxfmtPlugin::new())).await;

    // Dockerfile plugin (auto-detected based on Dockerfile)
    host.register(Box::new(dockerfile::DockerfilePlugin::new()))
        .await;

    // Rust Analyzer plugin (requires rust-analyzer in PATH)
    host.register(Box::new(rust_analyzer::RustAnalyzerPlugin::new()))
        .await;

    // Tombi plugin for TOML (via npx)
    host.register(Box::new(tombi::TombiPlugin::new())).await;

    // SQL plugin (auto-detected based on database context)
    host.register(Box::new(sql::SqlPlugin::new())).await;

    // Prisma plugin (auto-detected based on schema.prisma)
    host.register(Box::new(prisma::PrismaPlugin::new())).await;

    // Vue plugin (auto-detected based on vue dependency)
    host.register(Box::new(vue::VuePlugin::new())).await;

    // Astro plugin (auto-detected based on astro config)
    host.register(Box::new(astro::AstroPlugin::new())).await;

    // Svelte plugin (auto-detected based on svelte config)
    host.register(Box::new(svelte::SveltePlugin::new())).await;

    // Angular plugin (auto-detected based on angular.json)
    host.register(Box::new(angular::AngularPlugin::new())).await;

    // GraphQL plugin (auto-detected based on graphql config)
    host.register(Box::new(graphql::GraphqlPlugin::new())).await;

    // Bash plugin (shell script support)
    host.register(Box::new(bash::BashPlugin::new())).await;

    // MDX plugin (auto-detected based on mdx dependencies)
    host.register(Box::new(mdx::MdxPlugin::new())).await;

    // Pyright plugin (Python support via npx)
    host.register(Box::new(pyright::PyrightPlugin::new())).await;

    // Deno plugin (requires deno in PATH)
    host.register(Box::new(deno::DenoPlugin::new())).await;

    // Go plugin (requires gopls in PATH)
    host.register(Box::new(gopls::GoplsPlugin::new())).await;

    // Zig plugin (requires zls in PATH)
    host.register(Box::new(zls::ZlsPlugin::new())).await;
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
        "panager.tailwindcss",    // Activates if tailwind is in package.json/lock files
        "panager.eslint",         // Activates if .eslintrc.* or eslint.config.* exists
        "panager.oxlint",         // Activates if oxlintrc.json exists or oxlint in package.json
        "panager.prettier",       // Activates if .prettierrc.* exists
        "panager.biome",          // Activates if biome.json exists
        "panager.oxfmt",          // Activates for JS/TS projects (Prettier alternative)
        "panager.dockerfile",     // Activates if Dockerfile exists
        "panager.rust-analyzer",  // Activates if Cargo.toml exists and rust-analyzer is in PATH
        "panager.tombi",          // Activates if TOML files exist (via npx)
        "panager.sql",            // Activates if SQL/database context detected
        "panager.prisma",         // Activates if schema.prisma exists
        "panager.vue",            // Activates if vue dependency detected
        "panager.astro",          // Activates if astro config exists
        "panager.svelte",         // Activates if svelte config exists
        "panager.angular",        // Activates if angular.json exists
        "panager.graphql",        // Activates if graphql config exists
        "panager.bash",           // Activates if shell scripts detected
        "panager.mdx",            // Activates if mdx dependencies detected
        "panager.pyright",        // Activates if Python project detected
        "panager.deno",           // Activates if deno.json exists and deno is in PATH
        "panager.gopls",          // Activates if go.mod exists and gopls is in PATH
        "panager.zls",            // Activates if build.zig exists and zls is in PATH
    ];

    for plugin_id in conditional_plugins {
        if let Err(e) = host.activate(plugin_id).await {
            tracing::warn!("Failed to activate {} plugin: {}", plugin_id, e);
        }
    }
}
