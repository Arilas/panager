/**
 * Tab URL Utilities
 *
 * Functions for parsing and building tab URLs.
 * All tabs use a consistent URL scheme:
 *
 * - File tabs: file:///absolute/path/to/file.ts
 * - Diff tabs: diff:///absolute/path/to/file.ts?staged=true
 * - Chat tabs: chat://session-id or chat://new
 * - Glide tabs: glide://settings/editor or glide://welcome
 */

import type { TabScheme } from "./types";

// ============================================================
// URL Parsing
// ============================================================

/** Parsed tab URL components */
export interface ParsedTabUrl {
  /** URL scheme (file, diff, chat, glide) */
  scheme: TabScheme;
  /** Path component (file path, session ID, etc.) */
  path: string;
  /** Query parameters */
  params: Record<string, string>;
}

/**
 * Parse a tab URL into its components
 *
 * @param url The tab URL to parse
 * @returns Parsed URL components
 * @throws Error if URL is invalid
 */
export function parseTabUrl(url: string): ParsedTabUrl {
  // Handle file:// URLs
  if (url.startsWith("file://")) {
    const path = url.slice(7); // Remove "file://"
    return { scheme: "file", path, params: {} };
  }

  // Handle diff:// URLs
  if (url.startsWith("diff://")) {
    const withoutScheme = url.slice(7); // Remove "diff://"
    const [path, queryString] = withoutScheme.split("?");
    const params = parseQueryString(queryString);
    return { scheme: "diff", path, params };
  }

  // Handle chat:// URLs
  if (url.startsWith("chat://")) {
    const path = url.slice(7); // Remove "chat://"
    return { scheme: "chat", path, params: {} };
  }

  // Handle glide:// URLs
  if (url.startsWith("glide://")) {
    const path = url.slice(8); // Remove "glide://"
    return { scheme: "glide", path, params: {} };
  }

  throw new Error(`Invalid tab URL: ${url}`);
}

/**
 * Parse query string into key-value pairs
 */
function parseQueryString(queryString: string | undefined): Record<string, string> {
  if (!queryString) return {};

  const params: Record<string, string> = {};
  const pairs = queryString.split("&");

  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : "";
    }
  }

  return params;
}

// ============================================================
// URL Building
// ============================================================

/**
 * Build a tab URL from components
 *
 * @param scheme URL scheme
 * @param path Path component
 * @param params Optional query parameters
 * @returns Complete tab URL
 */
export function buildTabUrl(
  scheme: TabScheme,
  path: string,
  params?: Record<string, string>
): string {
  let url = `${scheme}://${path}`;

  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    url += `?${queryString}`;
  }

  return url;
}

// ============================================================
// Scheme-Specific Helpers
// ============================================================

/**
 * Build a file URL from an absolute path
 *
 * @param absolutePath Absolute file path
 * @returns file:// URL
 */
export function buildFileUrl(absolutePath: string): string {
  return `file://${absolutePath}`;
}

/**
 * Parse a file URL to get the absolute path
 *
 * @param url file:// URL
 * @returns Absolute file path
 * @throws Error if not a file URL
 */
export function parseFileUrl(url: string): string {
  if (!url.startsWith("file://")) {
    throw new Error(`Not a file URL: ${url}`);
  }
  return url.slice(7);
}

/**
 * Check if a URL is a file URL
 */
export function isFileUrl(url: string): boolean {
  return url.startsWith("file://");
}

/**
 * Build a diff URL from file path and staged flag
 *
 * @param absolutePath Absolute file path
 * @param staged Whether showing staged changes
 * @returns diff:// URL
 */
export function buildDiffUrl(absolutePath: string, staged: boolean): string {
  return buildTabUrl("diff", absolutePath, { staged: String(staged) });
}

/**
 * Parse a diff URL to get path and staged flag
 *
 * @param url diff:// URL
 * @returns Object with filePath and staged
 * @throws Error if not a diff URL
 */
export function parseDiffUrl(url: string): { filePath: string; staged: boolean } {
  const parsed = parseTabUrl(url);
  if (parsed.scheme !== "diff") {
    throw new Error(`Not a diff URL: ${url}`);
  }
  return {
    filePath: parsed.path,
    staged: parsed.params.staged === "true",
  };
}

/**
 * Check if a URL is a diff URL
 */
export function isDiffUrl(url: string): boolean {
  return url.startsWith("diff://");
}

/**
 * Build a chat URL from session ID
 *
 * @param sessionId Chat session ID or "new" for new chat
 * @returns chat:// URL
 */
export function buildChatUrl(sessionId: string): string {
  return `chat://${sessionId}`;
}

/**
 * Parse a chat URL to get the session ID
 *
 * @param url chat:// URL
 * @returns Session ID (or "new")
 * @throws Error if not a chat URL
 */
export function parseChatUrl(url: string): string {
  if (!url.startsWith("chat://")) {
    throw new Error(`Not a chat URL: ${url}`);
  }
  return url.slice(7);
}

/**
 * Check if a URL is a chat URL
 */
export function isChatUrl(url: string): boolean {
  return url.startsWith("chat://");
}

/**
 * Check if a chat URL is for a new session
 */
export function isNewChatUrl(url: string): boolean {
  return url === "chat://new";
}

/**
 * Build a glide URL (internal IDE pages)
 *
 * @param path Path like "settings/editor" or "welcome"
 * @returns glide:// URL
 */
export function buildGlideUrl(path: string): string {
  return `glide://${path}`;
}

/**
 * Parse a glide URL to get the path
 *
 * @param url glide:// URL
 * @returns Path component
 * @throws Error if not a glide URL
 */
export function parseGlideUrl(url: string): string {
  if (!url.startsWith("glide://")) {
    throw new Error(`Not a glide URL: ${url}`);
  }
  return url.slice(8);
}

/**
 * Check if a URL is a glide URL
 */
export function isGlideUrl(url: string): boolean {
  return url.startsWith("glide://");
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get the scheme from a URL
 */
export function getUrlScheme(url: string): TabScheme | null {
  if (url.startsWith("file://")) return "file";
  if (url.startsWith("diff://")) return "diff";
  if (url.startsWith("chat://")) return "chat";
  if (url.startsWith("glide://")) return "glide";
  return null;
}

/**
 * Extract file name from a file or diff URL
 * Returns the last path segment
 */
export function getFileNameFromUrl(url: string): string {
  let path: string;

  if (url.startsWith("file://")) {
    path = parseFileUrl(url);
  } else if (url.startsWith("diff://")) {
    path = parseDiffUrl(url).filePath;
  } else {
    return url; // Fallback - return the URL as-is
  }

  return path.split("/").pop() || path;
}

/**
 * Get the file extension from a URL
 * Returns empty string if no extension
 */
export function getExtensionFromUrl(url: string): string {
  const fileName = getFileNameFromUrl(url);
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}
