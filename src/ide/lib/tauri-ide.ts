/**
 * IDE-specific Tauri API calls
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  FileEntry,
  FileContent,
  GitFileChange,
  FileDiff,
  GitBranchInfo,
  SearchResult,
} from "../types";

// Window management

export async function openIdeWindow(
  projectId: string,
  projectPath: string,
  projectName: string
): Promise<void> {
  return invoke("ide_open_window", { projectId, projectPath, projectName });
}

export async function closeIdeWindow(projectId: string): Promise<void> {
  return invoke("ide_close_window", { projectId });
}

// File operations

export async function readDirectory(
  dirPath: string,
  depth?: number,
  includeHidden?: boolean
): Promise<FileEntry[]> {
  return invoke("ide_read_directory", { dirPath, depth, includeHidden });
}

export async function readFile(filePath: string): Promise<FileContent> {
  return invoke("ide_read_file", { filePath });
}

export async function getFileLanguage(filePath: string): Promise<string> {
  return invoke("ide_get_file_language", { filePath });
}

// Git operations

export async function getGitChanges(
  projectPath: string
): Promise<GitFileChange[]> {
  return invoke("ide_get_git_changes", { projectPath });
}

export async function getFileDiff(
  projectPath: string,
  filePath: string,
  staged: boolean
): Promise<FileDiff> {
  return invoke("ide_get_file_diff", { projectPath, filePath, staged });
}

export async function getGitBranch(projectPath: string): Promise<GitBranchInfo> {
  return invoke("ide_get_git_branch", { projectPath });
}

export async function stageFile(
  projectPath: string,
  filePath: string
): Promise<void> {
  return invoke("ide_stage_file", { projectPath, filePath });
}

export async function unstageFile(
  projectPath: string,
  filePath: string
): Promise<void> {
  return invoke("ide_unstage_file", { projectPath, filePath });
}

export async function discardChanges(
  projectPath: string,
  filePath: string
): Promise<void> {
  return invoke("ide_discard_changes", { projectPath, filePath });
}

// Search operations

export async function searchFileNames(
  projectPath: string,
  query: string,
  maxResults?: number
): Promise<string[]> {
  return invoke("ide_search_file_names", { projectPath, query, maxResults });
}

export async function searchFiles(
  projectPath: string,
  query: string,
  caseSensitive?: boolean,
  useRegex?: boolean,
  maxResults?: number
): Promise<SearchResult[]> {
  return invoke("ide_search_files", {
    projectPath,
    query,
    caseSensitive,
    useRegex,
    maxResults,
  });
}

// File system watcher

export async function startWatcher(
  windowLabel: string,
  projectPath: string
): Promise<void> {
  return invoke("ide_start_watcher", { windowLabel, projectPath });
}

export async function stopWatcher(windowLabel: string): Promise<void> {
  return invoke("ide_stop_watcher", { windowLabel });
}
