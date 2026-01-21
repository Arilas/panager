/**
 * Application-wide constants
 *
 * Centralized configuration for timing, limits, and other magic numbers.
 * Keeping these in one place makes it easier to tune and maintain.
 */

// ============================================================
// Timing Constants (milliseconds)
// ============================================================

/** Debounce delay for search input */
export const SEARCH_DEBOUNCE_MS = 300;

/** Debounce delay for file modification detection */
export const FILE_WATCHER_DEBOUNCE_MS = 100;

/** Debounce delay for content change notifications */
export const CONTENT_CHANGE_DEBOUNCE_MS = 150;

/** Debounce delay for diff computation */
export const DIFF_DEBOUNCE_MS = 200;

/** Delay before restoring persisted IDE state */
export const STATE_RESTORATION_DELAY_MS = 100;

/** Debounce delay for scroll position saving */
export const SCROLL_SAVE_DEBOUNCE_MS = 100;

/** Delay for symbol loading after editor mount */
export const SYMBOL_LOADING_DELAY_MS = 500;

// ============================================================
// Limits
// ============================================================

/** Maximum directory depth for path traversal */
export const MAX_DIRECTORY_DEPTH = 100;

/** Maximum file copies (e.g., "file copy 1000.txt") */
export const MAX_FILE_COPIES = 1000;

/** Maximum entries in navigation history */
export const MAX_NAVIGATION_HISTORY = 50;
