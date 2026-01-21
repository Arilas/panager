// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use clap::Parser;
use md5::{Digest, Md5};
use std::path::PathBuf;

/// Glide - AI-Powered Code Editor
#[derive(Parser, Debug)]
#[command(name = "glide")]
#[command(about = "AI-powered code editor", long_about = None)]
struct Args {
    /// Path to the project directory to open (optional)
    path: Option<PathBuf>,
}

/// Generate a project ID from the path using MD5 hash
fn generate_project_id(path: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

fn main() {
    let args = Args::parse();

    match args.path {
        Some(path) => {
            // Canonicalize the path
            let path = std::fs::canonicalize(&path).unwrap_or(path);

            // Get project name from folder name
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Untitled".to_string());

            // Generate project ID from path hash
            let path_str = path.to_string_lossy().to_string();
            let id = generate_project_id(&path_str);

            // Run with project
            glide_lib::run_with_project(Some((&id, &path_str, &name)));
        }
        None => {
            // Run without project - show welcome screen
            glide_lib::run_with_project(None);
        }
    }
}
