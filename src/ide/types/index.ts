/**
 * IDE-specific type definitions
 */

// Re-export types from separate files
export * from "./problems";
export * from "./plugin";
export * from "./panels";

/** Project context passed to IDE window via URL params */
export interface IdeProjectContext {
  projectId: string;
  projectPath: string;
  projectName: string;
}

/** File entry in the file tree */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
  extension?: string;
  isHidden: boolean;
  isGitignored: boolean;
}

/** Git file change status */
export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflicted";

/** Git file change */
export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
  oldPath?: string;
}

/** File diff for viewing changes */
export interface FileDiff {
  originalContent: string;
  modifiedContent: string;
  isBinary: boolean;
}

/** File content with metadata */
export interface FileContent {
  content: string;
  language: string;
  size: number;
  isBinary: boolean;
}

/** Search result */
export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/** Git branch info */
export interface GitBranchInfo {
  name: string;
  hasChanges: boolean;
  ahead: number;
  behind: number;
}

/** Git commit information */
export interface GitCommitInfo {
  oid: string;
  shortId: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorTime: number;
}

/** Options for creating a commit */
export interface CommitOptions {
  message: string;
  amend: boolean;
}

/** Git stash entry */
export interface GitStashEntry {
  index: number;
  message: string;
  oid: string;
  time: number;
}

/** Local branch information */
export interface GitLocalBranch {
  name: string;
  isCurrent: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
  lastCommit?: GitCommitInfo;
}

/** Git blame information for a single line */
export interface GitBlameLine {
  lineNumber: number;
  commitId: string;
  author: string;
  authorEmail: string;
  timestamp: number;
  originalLineNumber: number;
  summary: string;
}

/** Git blame result for a file */
export interface GitBlameResult {
  filePath: string;
  lines: GitBlameLine[];
}

/** Git operation progress */
export interface GitProgress {
  operation: string;
  stage: string;
  current: number;
  total: number;
  message?: string;
}

/** File system event */
export type IdeFileEvent =
  | { type: "created"; path: string }
  | { type: "deleted"; path: string }
  | { type: "modified"; path: string }
  | { type: "renamed"; oldPath: string; newPath: string };

/** Open file tab */
export interface OpenFile {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
  isPreview: boolean;
}

/** Editor cursor position */
export interface CursorPosition {
  line: number;
  column: number;
}

/** Sidebar panel type */
export type SidebarPanel = "files" | "git" | "search" | "settings" | null;
