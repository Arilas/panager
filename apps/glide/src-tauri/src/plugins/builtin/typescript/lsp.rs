//! TypeScript LSP Configuration
//!
//! This module provides the TypeScript-specific configuration for the generic LSP client.

use std::path::PathBuf;
use crate::plugins::lsp::{LspClient, LspConfig};

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
            // tsgo - Go-based TypeScript language server
            // https://github.com/nicholasdille/tsgo
            vec![
                "--yes".to_string(),
                "@anthropic/tsgo".to_string(),
                "lsp".to_string(),
            ]
        } else {
            // Default: typescript-language-server
            vec!["typescript-language-server".to_string(), "--stdio".to_string()]
        }
    }

    fn initialization_options(&self, _root: &PathBuf) -> serde_json::Value {
        if self.use_tsgo {
            // tsgo-specific initialization options
            serde_json::json!({
                "hostInfo": "Panager IDE"
            })
        } else {
            serde_json::json!({
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
            })
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
