//! LSP Configuration Trait
//!
//! Defines the interface for language server configurations.

use std::path::PathBuf;

/// Configuration trait for language servers.
///
/// Each language server plugin implements this trait to define
/// server-specific behavior like command, initialization options, etc.
pub trait LspConfig: Send + Sync + 'static {
    /// Unique server identifier used for settings lookup (e.g., "typescript", "eslint")
    /// This should match the key used in `languageServers` settings section.
    fn server_id(&self) -> &str;

    /// The command to execute (e.g., "npx", "node")
    fn command(&self) -> &str;

    /// Command arguments (e.g., ["vscode-json-language-server", "--stdio"])
    fn args(&self) -> Vec<String>;

    /// LSP initialization options (server-specific)
    fn initialization_options(&self, root: &PathBuf) -> serde_json::Value;

    /// Default settings for this language server.
    ///
    /// These settings are used as defaults and can be overridden by user settings
    /// in the `languageServers.<server_id>.settings` section.
    ///
    /// Example for TypeScript:
    /// ```json
    /// {
    ///   "format": {
    ///     "semicolons": "insert",
    ///     "indentSize": 2
    ///   },
    ///   "inlayHints": {
    ///     "includeInlayParameterNameHints": "literals"
    ///   }
    /// }
    /// ```
    fn default_settings(&self) -> serde_json::Value {
        serde_json::json!({})
    }

    /// LSP client capabilities to advertise
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

    /// Workspace configuration for workspace/configuration requests
    /// Override this to provide dynamic configuration based on merged settings.
    fn workspace_configuration(&self) -> serde_json::Value {
        serde_json::json!({})
    }

    /// Workspace configuration with user settings merged in.
    /// This is called by the LSP client when the server requests configuration.
    fn workspace_configuration_with_settings(&self, settings: &serde_json::Value) -> serde_json::Value {
        // Default implementation: return settings directly
        // Plugins can override this for custom merging logic
        settings.clone()
    }

    /// Map file extension to LSP language ID for didOpen
    fn language_id(&self, path: &str) -> &str;

    /// Diagnostic source name (e.g., "JSON", "CSS", "TypeScript")
    fn diagnostic_source(&self) -> &str;

    /// Whether this server should start for the given project
    fn should_activate(&self, _root: &PathBuf) -> bool {
        true
    }
}
