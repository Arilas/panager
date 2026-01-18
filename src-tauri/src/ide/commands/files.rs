//! File system commands for IDE

use crate::ide::types::{FileContent, FileEntry};
use ignore::WalkBuilder;
use std::fs;
use std::path::Path;
use tracing::debug;

/// Reads a directory and returns its contents as a file tree
///
/// Respects .gitignore patterns and excludes hidden files by default.
#[tauri::command]
#[specta::specta]
pub fn ide_read_directory(
    dir_path: String,
    depth: Option<u32>,
    include_hidden: Option<bool>,
) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.exists() {
        return Err(format!("Directory not found: {}", dir_path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let max_depth = depth.unwrap_or(1) as usize;
    let show_hidden = include_hidden.unwrap_or(false);

    debug!(
        "Reading directory: {} (depth: {}, hidden: {})",
        dir_path, max_depth, show_hidden
    );

    read_directory_entries(path, max_depth, show_hidden)
}

fn read_directory_entries(
    dir_path: &Path,
    max_depth: usize,
    include_hidden: bool,
) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();

    // Use ignore crate to respect .gitignore
    let walker = WalkBuilder::new(dir_path)
        .max_depth(Some(max_depth + 1)) // +1 because root is depth 0
        .hidden(!include_hidden)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .build();

    let root_depth = dir_path.components().count();

    for result in walker {
        match result {
            Ok(entry) => {
                let entry_path = entry.path();

                // Skip the root directory itself
                if entry_path == dir_path {
                    continue;
                }

                // Calculate depth relative to root
                let entry_depth = entry_path.components().count() - root_depth;

                // Only include direct children for depth 1
                if entry_depth > max_depth {
                    continue;
                }

                // Only include entries at exactly the first level for initial load
                // (children will be loaded on expand)
                if entry_depth != 1 {
                    continue;
                }

                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let is_hidden = name.starts_with('.');
                let is_directory = entry_path.is_dir();

                let extension = if !is_directory {
                    entry_path
                        .extension()
                        .map(|e| e.to_string_lossy().to_string())
                } else {
                    None
                };

                entries.push(FileEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_directory,
                    children: None, // Children loaded on demand
                    extension,
                    is_hidden,
                });
            }
            Err(e) => {
                debug!("Error walking directory: {}", e);
            }
        }
    }

    // Sort: directories first, then alphabetically (case-insensitive)
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Reads the content of a file
#[tauri::command]
#[specta::specta]
pub fn ide_read_file(file_path: String) -> Result<FileContent, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", file_path));
    }

    let metadata = fs::metadata(&path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let size = metadata.len();

    // Check if file is too large (> 10MB)
    if size > 10 * 1024 * 1024 {
        return Err("File is too large to open (> 10MB)".to_string());
    }

    // Try to read as text
    match fs::read_to_string(&path) {
        Ok(content) => {
            let language = detect_language(&file_path);
            Ok(FileContent {
                content,
                language,
                size,
                is_binary: false,
            })
        }
        Err(_) => {
            // File is likely binary
            Ok(FileContent {
                content: String::new(),
                language: "binary".to_string(),
                size,
                is_binary: true,
            })
        }
    }
}

/// Detects the programming language based on file extension
#[tauri::command]
#[specta::specta]
pub fn ide_get_file_language(file_path: String) -> String {
    detect_language(&file_path)
}

fn detect_language(file_path: &str) -> String {
    let path = Path::new(file_path);

    // Check filename first for special files
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Handle special filenames (case-insensitive)
    match filename.as_str() {
        "dockerfile" | "containerfile" => return "dockerfile".to_string(),
        "makefile" | "gnumakefile" => return "makefile".to_string(),
        "cmakelists.txt" => return "cmake".to_string(),
        "gemfile" | "rakefile" | "guardfile" | "podfile" | "fastfile" => return "ruby".to_string(),
        "vagrantfile" => return "ruby".to_string(),
        "brewfile" => return "ruby".to_string(),
        "justfile" => return "just".to_string(),
        "cargo.toml" | "cargo.lock" => return "toml".to_string(),
        "package.json" | "tsconfig.json" | "jsconfig.json" => return "json".to_string(),
        ".gitignore" | ".dockerignore" | ".npmignore" | ".prettierignore" => return "ignore".to_string(),
        ".gitattributes" => return "properties".to_string(),
        ".editorconfig" => return "ini".to_string(),
        ".env" | ".env.local" | ".env.development" | ".env.production" | ".env.test" => return "dotenv".to_string(),
        ".prettierrc" | ".eslintrc" | ".babelrc" => return "json".to_string(),
        "pom.xml" => return "xml".to_string(),
        "build.gradle" | "settings.gradle" => return "groovy".to_string(),
        "build.gradle.kts" | "settings.gradle.kts" => return "kotlin".to_string(),
        _ => {}
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match extension.to_lowercase().as_str() {
        // Rust
        "rs" => "rust",

        // JavaScript/TypeScript (including module variants)
        "js" => "javascript",
        "jsx" => "javascriptreact",
        "ts" => "typescript",
        "tsx" => "typescriptreact",
        "mjs" => "javascript",
        "cjs" => "javascript",
        "mts" => "typescript",
        "cts" => "typescript",
        "d.ts" => "typescript",

        // Web
        "html" | "htm" | "xhtml" => "html",
        "css" => "css",
        "scss" | "sass" => "scss",
        "less" => "less",
        "styl" | "stylus" => "stylus",
        "vue" => "vue",
        "svelte" => "svelte",
        "astro" => "astro",

        // Data formats
        "json" | "jsonc" | "json5" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" | "xsl" | "xslt" => "xml",
        "csv" | "tsv" => "csv",
        "plist" => "xml",

        // Documentation
        "md" | "markdown" | "mdx" => "markdown",
        "txt" | "text" => "plaintext",
        "rst" => "restructuredtext",
        "adoc" | "asciidoc" => "asciidoc",
        "tex" | "latex" => "latex",

        // Shell
        "sh" | "bash" | "zsh" | "fish" => "shellscript",
        "ps1" | "psm1" | "psd1" => "powershell",
        "bat" | "cmd" => "bat",

        // Python
        "py" | "pyw" | "pyi" => "python",
        "pyx" => "cython",
        "ipynb" => "jupyter",

        // Go
        "go" => "go",
        "mod" => "go.mod",
        "sum" => "go.sum",
        "work" => "go.work",

        // C/C++
        "c" => "c",
        "h" => "c",
        "cpp" | "cc" | "cxx" | "c++" => "cpp",
        "hpp" | "hh" | "hxx" | "h++" | "ipp" => "cpp",

        // C#
        "cs" => "csharp",
        "csx" => "csharp",
        "csproj" => "xml",

        // Java/Kotlin
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "groovy" | "gradle" => "groovy",

        // Swift/Objective-C
        "swift" => "swift",
        "m" => "objective-c",
        "mm" => "objective-cpp",

        // Ruby
        "rb" | "rbw" => "ruby",
        "erb" | "rhtml" => "erb",
        "gemspec" => "ruby",

        // PHP
        "php" | "php3" | "php4" | "php5" | "phtml" => "php",
        "blade.php" => "blade",

        // SQL
        "sql" | "mysql" | "pgsql" => "sql",
        "prisma" => "prisma",

        // Config files
        "ini" | "conf" | "cfg" | "cnf" => "ini",
        "properties" => "properties",
        "env" => "dotenv",
        "lock" => "lock",

        // Build tools
        "cmake" => "cmake",
        "ninja" => "ninja",

        // Misc languages
        "graphql" | "gql" => "graphql",
        "lua" => "lua",
        "r" | "rmd" => "r",
        "scala" | "sc" => "scala",
        "clj" | "cljs" | "cljc" | "edn" => "clojure",
        "ex" | "exs" => "elixir",
        "erl" | "hrl" => "erlang",
        "hs" | "lhs" => "haskell",
        "ml" | "mli" => "ocaml",
        "fs" | "fsi" | "fsx" | "fsscript" => "fsharp",
        "dart" => "dart",
        "zig" => "zig",
        "nim" | "nims" | "nimble" => "nim",
        "v" | "vsh" => "v",
        "sol" => "solidity",
        "move" => "move",
        "cairo" => "cairo",
        "wgsl" => "wgsl",
        "glsl" | "vert" | "frag" | "geom" | "comp" => "glsl",
        "hlsl" => "hlsl",

        // Lisp family
        "lisp" | "lsp" | "cl" => "lisp",
        "scm" | "ss" => "scheme",
        "rkt" => "racket",
        "el" | "elc" => "elisp",
        "fnl" => "fennel",

        // Perl
        "pl" | "pm" | "t" => "perl",
        "perl" => "perl",

        // Terraform/HCL
        "tf" | "tfvars" => "terraform",
        "hcl" => "hcl",

        // Protocol Buffers / Thrift
        "proto" => "protobuf",
        "thrift" => "thrift",

        // Assembly
        "asm" | "s" | "S" => "asm",

        // Nix
        "nix" => "nix",

        // Dhall
        "dhall" => "dhall",

        // Purescript
        "purs" => "purescript",

        // Elm
        "elm" => "elm",

        // Reason/ReScript
        "re" | "rei" => "reason",
        "res" | "resi" => "rescript",

        // Crystal
        "cr" => "crystal",

        // Julia
        "jl" => "julia",

        // Diff/Patch
        "diff" | "patch" => "diff",

        // Log files
        "log" => "log",

        // Default
        _ => "plaintext",
    }
    .to_string()
}
