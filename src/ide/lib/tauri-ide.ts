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
  GitCommitInfo,
  GitLocalBranch,
  GitStashEntry,
  GitBlameLine,
  GitBlameResult,
  CommitOptions,
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

// Git - Commit operations

export async function gitCommit(
  projectPath: string,
  options: CommitOptions
): Promise<GitCommitInfo> {
  return invoke("ide_git_commit", { projectPath, options });
}

export async function gitGetStagedSummary(
  projectPath: string
): Promise<GitFileChange[]> {
  return invoke("ide_git_get_staged_summary", { projectPath });
}

// Git - Branch operations

export async function gitListBranches(
  projectPath: string
): Promise<GitLocalBranch[]> {
  return invoke("ide_git_list_branches", { projectPath });
}

export async function gitCreateBranch(
  projectPath: string,
  name: string,
  fromRef?: string,
  checkout?: boolean
): Promise<void> {
  return invoke("ide_git_create_branch", { projectPath, name, fromRef, checkout });
}

export async function gitSwitchBranch(
  projectPath: string,
  name: string
): Promise<void> {
  return invoke("ide_git_switch_branch", { projectPath, name });
}

export async function gitDeleteBranch(
  projectPath: string,
  name: string,
  force?: boolean
): Promise<void> {
  return invoke("ide_git_delete_branch", { projectPath, name, force });
}

export async function gitCheckUncommittedChanges(
  projectPath: string
): Promise<boolean> {
  return invoke("ide_git_check_uncommitted_changes", { projectPath });
}

// Git - Stash operations

export async function gitStashSave(
  projectPath: string,
  message?: string,
  includeUntracked?: boolean
): Promise<void> {
  return invoke("ide_git_stash_save", { projectPath, message, includeUntracked });
}

export async function gitStashList(
  projectPath: string
): Promise<GitStashEntry[]> {
  return invoke("ide_git_stash_list", { projectPath });
}

export async function gitStashPop(
  projectPath: string,
  index: number
): Promise<void> {
  return invoke("ide_git_stash_pop", { projectPath, index });
}

export async function gitStashApply(
  projectPath: string,
  index: number
): Promise<void> {
  return invoke("ide_git_stash_apply", { projectPath, index });
}

export async function gitStashDrop(
  projectPath: string,
  index: number
): Promise<void> {
  return invoke("ide_git_stash_drop", { projectPath, index });
}

// Git - Blame operations

export async function gitBlame(
  projectPath: string,
  filePath: string
): Promise<GitBlameResult> {
  return invoke("ide_git_blame", { projectPath, filePath });
}

export async function gitBlameLine(
  projectPath: string,
  filePath: string,
  line: number
): Promise<GitBlameLine | null> {
  return invoke("ide_git_blame_line", { projectPath, filePath, line });
}

/** Get the content of a file from HEAD (last committed version) */
export async function gitShowHead(
  projectPath: string,
  filePath: string
): Promise<string | null> {
  return invoke("ide_git_show_head", { projectPath, filePath });
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

// File write operations

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  return invoke("ide_write_file", { filePath, content });
}

export async function createFile(filePath: string): Promise<void> {
  return invoke("ide_create_file", { filePath });
}

export async function deleteFile(filePath: string): Promise<void> {
  return invoke("ide_delete_file", { filePath });
}

export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke("ide_rename_file", { oldPath, newPath });
}

// Plugin notifications (for LSP/plugins)

export async function notifyFileOpened(
  filePath: string,
  content: string
): Promise<void> {
  return invoke("ide_notify_file_opened", { filePath, content });
}

export async function notifyFileChanged(
  filePath: string,
  content: string
): Promise<void> {
  return invoke("ide_notify_file_changed", { filePath, content });
}

export async function notifyFileClosed(filePath: string): Promise<void> {
  return invoke("ide_notify_file_closed", { filePath });
}

export async function notifyProjectOpened(projectPath: string): Promise<void> {
  return invoke("ide_notify_project_opened", { projectPath });
}

export async function notifyProjectClosed(): Promise<void> {
  return invoke("ide_notify_project_closed");
}

// Plugin management

import type { PluginInfo } from "../types/plugin";

export async function listPlugins(): Promise<PluginInfo[]> {
  return invoke("ide_list_plugins");
}

export async function enablePlugin(pluginId: string): Promise<void> {
  return invoke("ide_enable_plugin", { pluginId });
}

export async function disablePlugin(pluginId: string): Promise<void> {
  return invoke("ide_disable_plugin", { pluginId });
}

export async function getPlugin(pluginId: string): Promise<PluginInfo | null> {
  return invoke("ide_get_plugin", { pluginId });
}

// LSP operations

import type {
  LspLocation,
  LspHover,
  LspCompletionList,
  LspWorkspaceEdit,
  LspCodeAction,
  LspDocumentSymbol,
} from "../types/lsp";

export async function lspGotoDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<LspLocation[]> {
  return invoke("ide_lsp_goto_definition", { filePath, line, character });
}

export async function lspHover(
  filePath: string,
  line: number,
  character: number
): Promise<LspHover | null> {
  return invoke("ide_lsp_hover", { filePath, line, character });
}

export async function lspCompletion(
  filePath: string,
  line: number,
  character: number,
  triggerCharacter?: string
): Promise<LspCompletionList> {
  return invoke("ide_lsp_completion", {
    filePath,
    line,
    character,
    triggerCharacter,
  });
}

export async function lspReferences(
  filePath: string,
  line: number,
  character: number,
  includeDeclaration: boolean
): Promise<LspLocation[]> {
  return invoke("ide_lsp_references", {
    filePath,
    line,
    character,
    includeDeclaration,
  });
}

export async function lspRename(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<LspWorkspaceEdit> {
  return invoke("ide_lsp_rename", { filePath, line, character, newName });
}

export async function lspCodeAction(
  filePath: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
  diagnostics: unknown[]
): Promise<LspCodeAction[]> {
  return invoke("ide_lsp_code_action", {
    filePath,
    startLine,
    startCharacter,
    endLine,
    endCharacter,
    diagnostics,
  });
}

export async function lspDocumentSymbols(
  filePath: string
): Promise<LspDocumentSymbol[]> {
  return invoke("ide_lsp_document_symbols", { filePath });
}
