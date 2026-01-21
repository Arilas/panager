/**
 * Language ID mapping utility
 * 
 * Maps Monaco Editor language IDs to Shiki language IDs.
 * Monaco uses different IDs for some languages (e.g., "typescriptreact" vs "tsx").
 */

/**
 * Maps a Monaco language ID to the corresponding Shiki language ID.
 * 
 * Key mappings:
 * - typescriptreact -> tsx
 * - javascriptreact -> jsx
 * - Most other languages map 1:1
 * 
 * @param monacoLanguageId - The language ID from Monaco/VS Code
 * @returns The corresponding Shiki language ID, or the original if no mapping exists
 */
export function mapMonacoToShikiLanguage(monacoLanguageId: string): string {
  // Special mappings for React variants
  if (monacoLanguageId === "typescriptreact") {
    return "tsx";
  }
  if (monacoLanguageId === "javascriptreact") {
    return "jsx";
  }

  // Map Monaco-specific language IDs to Shiki equivalents
  const languageMap: Record<string, string> = {
    // Shell script
    shellscript: "shellscript",
    // Objective-C variants
    "objective-c": "objective-c",
    "objective-cpp": "objective-cpp",
    // Go module files
    "go.mod": "go.mod",
    "go.sum": "go.sum",
    "go.work": "go.work",
    // Special file types
    ignore: "gitignore",
    dotenv: "dotenv",
    // Jupyter notebooks
    jupyter: "json", // Jupyter notebooks are JSON, but Shiki might handle them differently
    // Lock files
    lock: "json", // Usually JSON format
  };

  // Check if we have a specific mapping
  if (languageMap[monacoLanguageId]) {
    return languageMap[monacoLanguageId];
  }

  // Most languages map 1:1, so return the original
  // Shiki supports most common languages with the same IDs as Monaco
  return monacoLanguageId;
}

/**
 * Gets all unique Shiki language IDs that we need to load.
 * This includes all languages that might be used, mapped from Monaco IDs.
 * 
 * @param monacoLanguageIds - Array of Monaco language IDs
 * @returns Array of unique Shiki language IDs to load
 */
export function getShikiLanguagesToLoad(monacoLanguageIds: string[]): string[] {
  const shikiLanguages = new Set<string>();
  
  for (const monacoId of monacoLanguageIds) {
    const shikiId = mapMonacoToShikiLanguage(monacoId);
    shikiLanguages.add(shikiId);
  }
  
  return Array.from(shikiLanguages);
}

/**
 * Gets all languages that might be detected by the backend.
 * This is a comprehensive list based on the Rust detect_language function.
 */
export function getAllPossibleLanguages(): string[] {
  return [
    // JavaScript/TypeScript
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    
    // Web
    "html",
    "css",
    "scss",
    "less",
    "stylus",
    "vue",
    "svelte",
    "astro",
    
    // Data formats
    "json",
    "yaml",
    "toml",
    "xml",
    "csv",
    
    // Documentation
    "markdown",
    "plaintext",
    "restructuredtext",
    "asciidoc",
    "latex",
    
    // Shell
    "shellscript",
    "powershell",
    "bat",
    
    // Python
    "python",
    "cython",
    "jupyter",
    
    // Go
    "go",
    "go.mod",
    "go.sum",
    "go.work",
    
    // C/C++
    "c",
    "cpp",
    
    // C#
    "csharp",
    
    // Java/Kotlin
    "java",
    "kotlin",
    "groovy",
    
    // Swift/Objective-C
    "swift",
    "objective-c",
    "objective-cpp",
    
    // Ruby
    "ruby",
    "erb",
    
    // PHP
    "php",
    "blade",
    
    // SQL
    "sql",
    "prisma",
    
    // Config files
    "ini",
    "properties",
    "dotenv",
    "lock",
    
    // Build tools
    "cmake",
    "ninja",
    "dockerfile",
    "makefile",
    "just",
    
    // Misc languages
    "graphql",
    "lua",
    "r",
    "scala",
    "clojure",
    "elixir",
    "erlang",
    "haskell",
    "ocaml",
    "fsharp",
    "dart",
    "zig",
    "nim",
    "v",
    "solidity",
    "move",
    "cairo",
    "wgsl",
    "glsl",
    "hlsl",
    
    // Lisp family
    "lisp",
    "scheme",
    "racket",
    "elisp",
    "fennel",
    
    // Perl
    "perl",
    
    // Terraform/HCL
    "terraform",
    "hcl",
    
    // Protocol Buffers / Thrift
    "protobuf",
    "thrift",
    
    // Assembly
    "asm",
    
    // Nix
    "nix",
    
    // Dhall
    "dhall",
    
    // Purescript
    "purescript",
    
    // Elm
    "elm",
    
    // Reason/ReScript
    "reason",
    "rescript",
    
    // Crystal
    "crystal",
    
    // Julia
    "julia",
    
    // Diff/Patch
    "diff",
    
    // Log files
    "log",
    
    // Rust
    "rust",
  ];
}
