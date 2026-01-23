//! TypeScript LSP Configuration
//!
//! This module provides the TypeScript-specific configuration for the generic LSP client.

use std::path::PathBuf;
use tracing::{debug, warn};
use crate::plugins::lsp::{LspClient, LspConfig};

/// Find TypeScript SDK path in the project
/// Returns an absolute file:// URI path to the TypeScript lib directory
fn find_typescript_tsdk(root: &PathBuf) -> Option<String> {
    // Normalize the root path
    let root = if let Ok(canonical) = std::fs::canonicalize(root) {
        canonical
    } else {
        root.clone()
    };
    
    // Check for node_modules/typescript/lib in project root
    let local_ts = root.join("node_modules/typescript/lib");
    if local_ts.exists() && local_ts.is_dir() {
        debug!("Found TypeScript SDK at: {:?}", local_ts);
        if let Ok(abs_path) = std::fs::canonicalize(&local_ts) {
            // Normalize path separators for file:// URI (use forward slashes)
            let path_str = abs_path.to_string_lossy().replace('\\', "/");
            let uri = format!("file://{}", path_str);
            debug!("Using absolute path: {}", uri);
            return Some(uri);
        }
    }
    
    // Check parent directories (for monorepos)
    let mut current = root.clone();
    for depth in 0..5 {
        // Limit search depth
        if let Some(parent) = current.parent() {
            let ts_path = parent.join("node_modules/typescript/lib");
            if ts_path.exists() && ts_path.is_dir() {
                debug!("Found TypeScript SDK in parent (depth {}): {:?}", depth, ts_path);
                if let Ok(abs_path) = std::fs::canonicalize(&ts_path) {
                    // Normalize path separators for file:// URI (use forward slashes)
                    let path_str = abs_path.to_string_lossy().replace('\\', "/");
                    let uri = format!("file://{}", path_str);
                    debug!("Using absolute path: {}", uri);
                    return Some(uri);
                }
            }
            current = parent.to_path_buf();
        } else {
            break;
        }
    }
    
    debug!("TypeScript SDK not found in project or parent directories");
    None
}

/// TypeScript language server configuration
pub struct TypeScriptConfig {
    /// Merged settings from defaults + user overrides
    pub settings: serde_json::Value,
    /// Whether to use tsgo (Go-based TypeScript server) instead of typescript-language-server
    pub use_tsgo: bool,
}

impl TypeScriptConfig {
    /// Create a new TypeScript config with default settings
    pub fn new() -> Self {
        Self {
            settings: Self::default_settings_static(),
            use_tsgo: false,
        }
    }

    /// Create a new TypeScript config with custom settings
    pub fn with_settings(settings: serde_json::Value, use_tsgo: bool) -> Self {
        Self { settings, use_tsgo }
    }

    /// Default settings (static version for use in new())
    fn default_settings_static() -> serde_json::Value {
        serde_json::json!({
            "typescript": {
                "inlayHints": {
                    "includeInlayParameterNameHints": "literals",
                    "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
                    "includeInlayFunctionParameterTypeHints": false,
                    "includeInlayVariableTypeHints": false,
                    "includeInlayPropertyDeclarationTypeHints": false,
                    "includeInlayFunctionLikeReturnTypeHints": true,
                    "includeInlayEnumMemberValueHints": true
                },
                "preferences": {
                    "importModuleSpecifierPreference": "shortest",
                    "includePackageJsonAutoImports": "auto"
                },
                "tsserver": {
                    "enableProjectDiagnostics": true
                }
            },
            "javascript": {
                "inlayHints": {
                    "includeInlayParameterNameHints": "literals",
                    "includeInlayParameterNameHintsWhenArgumentMatchesName": false,
                    "includeInlayFunctionParameterTypeHints": false,
                    "includeInlayVariableTypeHints": false,
                    "includeInlayPropertyDeclarationTypeHints": false,
                    "includeInlayFunctionLikeReturnTypeHints": true,
                    "includeInlayEnumMemberValueHints": true
                },
                "preferences": {
                    "importModuleSpecifierPreference": "shortest",
                    "includePackageJsonAutoImports": "auto"
                }
            }
        })
    }
}

impl Default for TypeScriptConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl LspConfig for TypeScriptConfig {
    fn server_id(&self) -> &str {
        "typescript"
    }

    fn command(&self) -> &str {
        if self.use_tsgo {
            "npx"
        } else {
            "npx"
        }
    }

    fn args(&self) -> Vec<String> {
        if self.use_tsgo {
            // tsgo - Go-based TypeScript language server (TypeScript Native Preview)
            // https://github.com/microsoft/typescript-go
            // https://www.npmjs.com/package/@typescript/native-preview
            vec![
                "--yes".to_string(),
                "@typescript/native-preview".to_string(),
                "--lsp".to_string(),
                "--stdio".to_string(),
            ]
        } else {
            // Default: typescript-language-server
            vec!["typescript-language-server".to_string(), "--stdio".to_string()]
        }
    }

    fn initialization_options(&self, root: &PathBuf) -> serde_json::Value {
        if self.use_tsgo {
            // tsgo-specific initialization options
            serde_json::json!({
                "hostInfo": "Panager IDE"
            })
        } else {
            // Find TypeScript installation
            let tsdk_path = find_typescript_tsdk(root);
            
            debug!("TypeScript SDK search for root {:?}: {:?}", root, tsdk_path);
            
            let mut options = serde_json::json!({
                "hostInfo": "Panager IDE",
                "tsserver": {
                    "useSyntaxServer": "auto",
                    "logVerbosity": "off"
                },
                "preferences": {
                    "importModuleSpecifierPreference": "shortest",
                    "includePackageJsonAutoImports": "auto",
                    "allowIncompleteCompletions": true,
                    "includeCompletionsForModuleExports": true
                },
                "disableAutomaticTypingAcquisition": false
            });
            
            // Add typescript.tsdk - required by typescript-language-server
            if let Some(tsdk) = tsdk_path {
                options["typescript"] = serde_json::json!({
                    "tsdk": tsdk
                });
                debug!("Added typescript.tsdk: {}", tsdk);
            } else {
                // TypeScript SDK not found - this is required by typescript-language-server
                // We need to provide it, so try to use npx to resolve it or provide a path
                // that the server can resolve relative to the project root
                warn!("TypeScript SDK not found in project, using relative path fallback");
                
                // Use relative path - the server should resolve it relative to rootUri
                // This works if TypeScript is installed via npx or in a parent node_modules
                options["typescript"] = serde_json::json!({
                    "tsdk": "node_modules/typescript/lib"
                });
                debug!("Using fallback typescript.tsdk: node_modules/typescript/lib");
            }
            
            options
        }
    }

    fn default_settings(&self) -> serde_json::Value {
        Self::default_settings_static()
    }

    fn capabilities(&self) -> serde_json::Value {
        serde_json::json!({
            "textDocument": {
                "publishDiagnostics": {
                    "relatedInformation": true,
                    "codeDescriptionSupport": true
                },
                "synchronization": {
                    "didSave": true,
                    "willSave": false,
                    "willSaveWaitUntil": false
                },
                "documentSymbol": {
                    "hierarchicalDocumentSymbolSupport": true,
                    "symbolKind": {
                        "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                    }
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true,
                        "documentationFormat": ["markdown", "plaintext"]
                    }
                },
                "definition": {
                    "linkSupport": true
                },
                "references": {},
                "rename": {
                    "prepareSupport": true
                },
                "codeAction": {
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": ["quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"]
                        }
                    }
                }
            },
            "workspace": {
                "workspaceFolders": true,
                "configuration": true,
                "didChangeConfiguration": {
                    "dynamicRegistration": true
                }
            }
        })
    }

    fn workspace_configuration(&self) -> serde_json::Value {
        // Return the merged settings (defaults + user overrides)
        self.settings.clone()
    }

    fn language_id(&self, ext: &str) -> &str {
        match ext {
            "tsx" => "typescriptreact",
            "jsx" => "javascriptreact",
            "js" | "mjs" | "cjs" => "javascript",
            _ => "typescript",
        }
    }

    fn diagnostic_source(&self) -> &str {
        "TypeScript"
    }

    fn should_activate(&self, root: &PathBuf) -> bool {
        root.join("tsconfig.json").exists()
            || root.join("jsconfig.json").exists()
            || root.join("package.json").exists()
    }
}

/// Type alias for TypeScript LSP client
pub type TypeScriptLspClient = LspClient<TypeScriptConfig>;
