//! Search commands for IDE

use crate::ide::types::SearchResult;
use ignore::WalkBuilder;
use regex::Regex;
use std::fs;

/// Searches for files by name (fuzzy matching)
#[tauri::command]
#[specta::specta]
pub fn ide_search_file_names(
    project_path: String,
    query: String,
    max_results: Option<u32>,
) -> Result<Vec<String>, String> {
    let max = max_results.unwrap_or(50) as usize;
    let query_lower = query.to_lowercase();
    let query_chars: Vec<char> = query_lower.chars().collect();

    let mut results: Vec<(String, i32)> = Vec::new();

    let walker = WalkBuilder::new(&project_path)
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        // Get relative path
        let relative_path = path
            .strip_prefix(&project_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        // Calculate fuzzy match score
        if let Some(score) = fuzzy_match(&relative_path.to_lowercase(), &query_chars) {
            results.push((relative_path, score));
        }
    }

    // Sort by score (higher is better)
    results.sort_by(|a, b| b.1.cmp(&a.1));

    // Take top results
    Ok(results.into_iter().take(max).map(|(path, _)| path).collect())
}

/// Searches for content within files
#[tauri::command]
#[specta::specta]
pub fn ide_search_files(
    project_path: String,
    query: String,
    case_sensitive: Option<bool>,
    use_regex: Option<bool>,
    max_results: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(100) as usize;
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = use_regex.unwrap_or(false);

    let pattern = if use_regex {
        if case_sensitive {
            Regex::new(&query)
        } else {
            Regex::new(&format!("(?i){}", query))
        }
        .map_err(|e| format!("Invalid regex: {}", e))?
    } else {
        let escaped = regex::escape(&query);
        if case_sensitive {
            Regex::new(&escaped)
        } else {
            Regex::new(&format!("(?i){}", escaped))
        }
        .map_err(|e| format!("Invalid pattern: {}", e))?
    };

    let mut results: Vec<SearchResult> = Vec::new();

    let walker = WalkBuilder::new(&project_path)
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .build();

    'outer: for entry in walker.flatten() {
        let path = entry.path();

        // Skip directories and binary files
        if path.is_dir() {
            continue;
        }

        // Skip large files (> 1MB)
        if let Ok(metadata) = fs::metadata(path) {
            if metadata.len() > 1024 * 1024 {
                continue;
            }
        }

        // Try to read file
        if let Ok(content) = fs::read_to_string(path) {
            let relative_path = path
                .strip_prefix(&project_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            for (line_idx, line) in content.lines().enumerate() {
                for mat in pattern.find_iter(line) {
                    results.push(SearchResult {
                        file_path: relative_path.clone(),
                        line_number: (line_idx + 1) as u32,
                        line_content: line.to_string(),
                        match_start: mat.start() as u32,
                        match_end: mat.end() as u32,
                    });

                    if results.len() >= max {
                        break 'outer;
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Simple fuzzy matching algorithm
/// Returns a score if the pattern matches, higher is better
fn fuzzy_match(text: &str, pattern: &[char]) -> Option<i32> {
    if pattern.is_empty() {
        return Some(0);
    }

    let text_chars: Vec<char> = text.chars().collect();
    let mut pattern_idx = 0;
    let mut score = 0;
    let mut consecutive = 0;
    let mut last_match_idx: Option<usize> = None;

    for (i, c) in text_chars.iter().enumerate() {
        if pattern_idx < pattern.len() && *c == pattern[pattern_idx] {
            pattern_idx += 1;

            // Bonus for consecutive matches
            if let Some(last) = last_match_idx {
                if i == last + 1 {
                    consecutive += 1;
                    score += consecutive * 2;
                } else {
                    consecutive = 0;
                }
            }

            // Bonus for matching at word boundaries
            if i == 0 || text_chars[i - 1] == '/' || text_chars[i - 1] == '\\' || text_chars[i - 1] == '_' || text_chars[i - 1] == '-' {
                score += 5;
            }

            score += 1;
            last_match_idx = Some(i);
        }
    }

    if pattern_idx == pattern.len() {
        // Bonus for shorter paths
        score += (100 - text.len().min(100)) as i32;
        Some(score)
    } else {
        None
    }
}
