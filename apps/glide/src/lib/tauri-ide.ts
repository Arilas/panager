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

import type { WriteFileResult, FormatterResult } from "../types/settings";

export type { WriteFileResult, FormatterResult };

export interface WriteFileOptions {
  /** Whether to run formatters on save */
  runFormatters?: boolean;
  /** Project path (required for format-on-save) */
  projectPath?: string;
  /** Scope default folder (optional, for settings hierarchy) */
  scopeDefaultFolder?: string | null;
}

export async function writeFile(
  filePath: string,
  content: string,
  options?: WriteFileOptions
): Promise<WriteFileResult> {
  return invoke("ide_write_file", {
    filePath,
    content,
    runFormatters: options?.runFormatters,
    projectPath: options?.projectPath,
    scopeDefaultFolder: options?.scopeDefaultFolder,
  });
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

export async function createDirectory(dirPath: string): Promise<void> {
  return invoke("ide_create_directory", { dirPath });
}

export async function deleteDirectory(dirPath: string): Promise<void> {
  return invoke("ide_delete_directory", { dirPath });
}

export async function copyPath(
  sourcePath: string,
  destPath: string
): Promise<void> {
  return invoke("ide_copy_path", { sourcePath, destPath });
}

export async function copyDirectory(
  sourcePath: string,
  destPath: string
): Promise<void> {
  return invoke("ide_copy_directory", { sourcePath, destPath });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke("ide_path_exists", { path });
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke("ide_reveal_in_finder", { path });
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
  LspInlayHint,
  LspDocumentHighlight,
  LspSignatureHelp,
  LspFormattingOptions,
  LspTextEdit,
  LspFoldingRange,
  LspSelectionRange,
  LspLinkedEditingRanges,
  LspPosition,
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

export async function lspInlayHints(
  filePath: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): Promise<LspInlayHint[]> {
  return invoke("ide_lsp_inlay_hints", {
    filePath,
    startLine,
    startCharacter,
    endLine,
    endCharacter,
  });
}

export async function lspDocumentHighlight(
  filePath: string,
  line: number,
  character: number
): Promise<LspDocumentHighlight[]> {
  return invoke("ide_lsp_document_highlight", { filePath, line, character });
}

export async function lspSignatureHelp(
  filePath: string,
  line: number,
  character: number,
  triggerCharacter?: string
): Promise<LspSignatureHelp | null> {
  return invoke("ide_lsp_signature_help", {
    filePath,
    line,
    character,
    triggerCharacter,
  });
}

export async function lspFormatDocument(
  filePath: string,
  options: LspFormattingOptions
): Promise<LspTextEdit[]> {
  return invoke("ide_lsp_format_document", { filePath, options });
}

export async function lspFormatRange(
  filePath: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
  options: LspFormattingOptions
): Promise<LspTextEdit[]> {
  return invoke("ide_lsp_format_range", {
    filePath,
    startLine,
    startCharacter,
    endLine,
    endCharacter,
    options,
  });
}

export async function lspFormatOnType(
  filePath: string,
  line: number,
  character: number,
  triggerCharacter: string,
  options: LspFormattingOptions
): Promise<LspTextEdit[]> {
  return invoke("ide_lsp_format_on_type", {
    filePath,
    line,
    character,
    triggerCharacter,
    options,
  });
}

export async function lspTypeDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<LspLocation[]> {
  return invoke("ide_lsp_type_definition", { filePath, line, character });
}

export async function lspImplementation(
  filePath: string,
  line: number,
  character: number
): Promise<LspLocation[]> {
  return invoke("ide_lsp_implementation", { filePath, line, character });
}

export async function lspFoldingRange(filePath: string): Promise<LspFoldingRange[]> {
  return invoke("ide_lsp_folding_range", { filePath });
}

export async function lspSelectionRange(
  filePath: string,
  positions: LspPosition[]
): Promise<LspSelectionRange[]> {
  return invoke("ide_lsp_selection_range", { filePath, positions });
}

export async function lspLinkedEditingRange(
  filePath: string,
  line: number,
  character: number
): Promise<LspLinkedEditingRanges | null> {
  return invoke("ide_lsp_linked_editing_range", { filePath, line, character });
}

// Settings operations

import type {
  IdeSettings,
  PartialIdeSettings,
  SettingsLevel,
  FormatterConfig,
} from "../types/settings";

/**
 * Load merged effective settings (user → scope → workspace)
 * Returns ready-to-use settings with all levels merged.
 */
export async function loadSettings(
  projectPath: string,
  scopeDefaultFolder?: string | null
): Promise<IdeSettings> {
  return invoke("ide_load_settings", { projectPath, scopeDefaultFolder });
}

/**
 * Load settings merged up to a specific level
 * - User: defaults + user settings only
 * - Scope: defaults + user + scope settings
 * - Workspace: defaults + user + scope + workspace settings
 */
export async function loadSettingsForLevel(
  level: SettingsLevel,
  projectPath: string,
  scopeDefaultFolder?: string | null
): Promise<IdeSettings> {
  return invoke("ide_load_settings_for_level", {
    level,
    projectPath,
    scopeDefaultFolder,
  });
}

/**
 * Get raw settings for a specific level (for settings dialog editing)
 * Returns only the settings explicitly set at this level.
 */
export async function getSettingsForLevel(
  level: SettingsLevel,
  projectPath?: string | null,
  scopeDefaultFolder?: string | null
): Promise<PartialIdeSettings> {
  return invoke("ide_get_settings_for_level", {
    level,
    projectPath,
    scopeDefaultFolder,
  });
}

/**
 * Update a setting at a specific level
 * Uses dot-notation key path (e.g., "editor.fontSize")
 */
export async function updateSetting(
  level: SettingsLevel,
  key: string,
  value: unknown,
  projectPath?: string | null,
  scopeDefaultFolder?: string | null
): Promise<void> {
  return invoke("ide_update_setting", {
    level,
    key,
    value,
    projectPath,
    scopeDefaultFolder,
  });
}

/**
 * Delete a setting at a specific level (revert to lower level)
 */
export async function deleteSetting(
  level: SettingsLevel,
  key: string,
  projectPath?: string | null,
  scopeDefaultFolder?: string | null
): Promise<void> {
  return invoke("ide_delete_setting", {
    level,
    key,
    projectPath,
    scopeDefaultFolder,
  });
}

/**
 * Get available formatter presets
 */
export async function getFormatterPresets(): Promise<FormatterConfig[]> {
  return invoke("ide_get_formatter_presets");
}

/**
 * Get the path where settings would be stored for a given level
 */
export async function getSettingsPath(
  level: SettingsLevel,
  projectPath?: string | null,
  scopeDefaultFolder?: string | null
): Promise<string> {
  return invoke("ide_get_settings_path", {
    level,
    projectPath,
    scopeDefaultFolder,
  });
}

// Recent Projects

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpened: string; // ISO date string
}

/**
 * Get list of recently opened projects
 */
export async function getRecentProjects(): Promise<RecentProject[]> {
  return invoke("ide_get_recent_projects");
}

/**
 * Add or update a project in the recent list
 */
export async function addRecentProject(
  id: string,
  name: string,
  path: string
): Promise<void> {
  return invoke("ide_add_recent_project", { id, name, path });
}

/**
 * Remove a project from the recent list
 */
export async function removeRecentProject(path: string): Promise<void> {
  return invoke("ide_remove_recent_project", { path });
}

/**
 * Clear all recent projects
 */
export async function clearRecentProjects(): Promise<void> {
  return invoke("ide_clear_recent_projects");
}
