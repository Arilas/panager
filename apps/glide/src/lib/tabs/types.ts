/**
 * Tab System Types
 *
 * Core type definitions for the unified tab management system.
 * This file defines the interfaces for tab resolvers, tab state,
 * and tab groups (split view support).
 */

import type { ComponentType, ReactElement } from "react";

// ============================================================
// URL Schemes
// ============================================================

/** Supported URL schemes for tabs */
export type TabScheme = "file" | "diff" | "chat" | "glide";

// ============================================================
// Tab Resolver Interface
// ============================================================

/** Props passed to tab content components */
export interface TabComponentProps<T = unknown> {
  /** The tab URL */
  url: string;
  /** The resolved tab data */
  data: T;
  /** The group ID this tab belongs to */
  groupId: string;
  /** Whether this group is currently active */
  isGroupActive: boolean;
}

/** Props for error components shown when tab resolution fails */
export interface TabErrorProps {
  /** The tab URL that failed to resolve */
  url: string;
  /** Error message */
  error: string;
  /** Callback to retry resolution */
  onRetry: () => void;
}

/**
 * Tab Resolver Interface
 *
 * Resolvers are responsible for:
 * 1. Determining if they can handle a given URL (canResolve)
 * 2. Loading the tab content (resolve)
 * 3. Providing the component to render the tab (getComponent)
 * 4. Providing error UI for failed resolution (getErrorComponent)
 * 5. Optionally mapping URLs to file paths (toFilePath)
 * 6. Handling external changes like file modifications (onExternalChange)
 */
export interface TabResolver<T = unknown> {
  /** Unique identifier for this resolver (e.g., 'file', 'diff', 'chat') */
  readonly id: string;

  /** Priority (higher = checked first). Default 0. */
  readonly priority: number;

  /** URL schemes this resolver can handle */
  readonly schemes: readonly string[];

  /** Check if this resolver can handle the given URL */
  canResolve(url: string): boolean;

  /**
   * Resolve a URL to a fully loaded tab state.
   *
   * This is called when:
   * 1. A lazy tab becomes active and needs content
   * 2. A tab is opened with autoFocus=true
   *
   * May return a different URL than the input (e.g., chat://new -> chat://session-id)
   *
   * @throws Error if resolution fails
   */
  resolve(url: string): Promise<ResolvedTabState<T>>;

  /** Get the React component to render this tab type */
  getComponent(): ComponentType<TabComponentProps<T>>;

  /** Get the React component to show when resolution fails */
  getErrorComponent(): ComponentType<TabErrorProps>;

  /** Get display name for the tab bar from URL */
  getDisplayName(url: string): string;

  /**
   * Get the icon component for this tab type.
   * @param url - The tab URL
   * @param className - CSS class to apply to the icon
   * @returns React element for the icon
   */
  getIcon(url: string, className?: string): ReactElement;

  /**
   * Convert tab URL to file path for file tree/git focus.
   * Returns null if this tab type doesn't have an associated file path.
   */
  toFilePath?(url: string): string | null;

  /**
   * Handle external change notification (file changed on disk, etc.)
   * Returns updated state, or null if no update needed.
   */
  onExternalChange?(
    url: string,
    meta: unknown
  ): Promise<ResolvedTabState<T> | null>;
}

// ============================================================
// Tab State Types
// ============================================================

/** Lazy tab state - stored before content is loaded */
export interface LazyTabState {
  /** The tab URL */
  url: string;
  /** Resolver ID that will handle this tab */
  type: string;
  /** Display name for the tab bar */
  displayName: string;
}

/** Resolved tab state - returned by resolver.resolve() */
export interface ResolvedTabState<T = unknown> {
  /** The tab URL (may differ from input if URL changed during resolution) */
  url: string;
  /** Resolver ID that created this state */
  type: string;
  /** Display name for the tab bar */
  displayName: string;
  /** Type-specific data (FileTabData, DiffTabData, ChatTabData, etc.) */
  data: T;
}

/** Session data persisted for tabs */
export interface TabSessionData {
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  selections?: unknown[];
  foldedRegions?: number[];
}

/**
 * Tab Entry - Complete state for a single tab
 *
 * This is the main type stored in the tabs store and persisted to database.
 */
export interface TabEntry {
  /** The tab URL (unique within a group) */
  url: string;
  /** Resolver ID - used to find resolver for this tab */
  type: string;
  /** Display name shown in tab bar */
  displayName: string;
  /** Preview tabs are replaced when opening another file */
  isPreview: boolean;
  /** Pinned tabs cannot be closed and stay at the start */
  isPinned: boolean;
  /** Dirty flag - content has unsaved changes */
  isDirty: boolean;
  /** Resolved state - null means lazy (not yet loaded) */
  resolved: ResolvedTabState | null;
  /** Error message if resolution failed */
  error?: string;

  // Session data - persisted separately from resolved content
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  selections?: unknown[];
  foldedRegions?: number[];
}

// ============================================================
// Tab Group Types (Split View Support)
// ============================================================

/**
 * Tab Group - Container for tabs in a split view pane
 *
 * Each group has:
 * - Its own list of tabs
 * - Its own active tab
 * - No duplicate URLs within the same group
 *
 * The same URL CAN exist in different groups (split view of same file).
 */
export interface TabGroup {
  /** Unique group identifier */
  id: string;
  /** Tabs in this group (ordered) */
  tabs: TabEntry[];
  /** Currently active tab URL in this group (null if no tabs) */
  activeUrl: string | null;
}

// ============================================================
// Tab Store Types
// ============================================================

/** Options for opening a tab */
export interface OpenTabOptions {
  /** The tab URL to open */
  url: string;
  /** Open as preview tab (default: true for file clicks) */
  isPreview?: boolean;
  /** Focus the tab after opening (default: true) */
  autoFocus?: boolean;
  /** Initial cursor position */
  cursorPosition?: { line: number; column: number };
  /** Target group ID (defaults to activeGroupId) */
  groupId?: string;
}

// ============================================================
// Resolver-Specific Data Types
// ============================================================

/** Data for file tabs */
export interface FileTabData {
  /** Absolute file path */
  path: string;
  /** Current content in editor */
  currentContent: string;
  /** Content on disk (for dirty detection) */
  savedContent: string;
  /** Git HEAD content for inline diff (null if not available) */
  headContent: string | null;
  /** Language identifier for syntax highlighting */
  language: string;
}

/** Data for diff tabs */
export interface DiffTabData {
  /** Absolute file path */
  filePath: string;
  /** Original content (from git HEAD) */
  originalContent: string;
  /** Modified content (working tree or staged) */
  modifiedContent: string;
  /** Language identifier */
  language: string;
  /** Whether showing staged changes */
  staged: boolean;
}

/** Data for chat tabs */
export interface ChatTabData {
  /** Chat session ID */
  sessionId: string;
  /** Session name */
  sessionName: string;
}

/** Data for markdown tabs */
export interface MarkdownTabData extends FileTabData {
  /** Whether preview is currently shown */
  showPreview: boolean;
}
