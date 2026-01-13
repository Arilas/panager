import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CloneOptions,
  CloneProgress,
  CloneResult,
  CommandResult,
  CreateProjectCommandRequest,
  CreateProjectGroupRequest,
  CreateProjectLinkRequest,
  CreateProjectRequest,
  CreateScopeLinkRequest,
  CreateScopeRequest,
  CreateSshAliasRequest,
  Editor,
  EditorInfo,
  GitIncludeIf,
  GitStatusCache,
  GpgSigningMethod,
  ParsedGitUrl,
  Project,
  ProjectCommand,
  ProjectGroup,
  ProjectLink,
  ProjectStatistics,
  ProjectWithStatus,
  Scope,
  ScopeGitConfig,
  ScopeLink,
  ScopeWithLinks,
  SshAlias,
  TempProjectSettings,
  TempProjectRequest,
  TempProjectProgress,
  TempProjectResult,
  Terminal,
  TerminalInfo,
} from "../types";

// Scopes
export async function getScopes(): Promise<ScopeWithLinks[]> {
  return invoke("get_scopes");
}

export async function createScope(request: CreateScopeRequest): Promise<Scope> {
  return invoke("create_scope", { request });
}

export async function updateScope(
  id: string,
  name?: string,
  color?: string,
  icon?: string,
  defaultEditorId?: string,
  defaultFolder?: string,
  folderScanInterval?: number,
  sshAlias?: string,
  tempProjectSettings?: TempProjectSettings
): Promise<void> {
  return invoke("update_scope", {
    id,
    name,
    color,
    icon,
    defaultEditorId,
    defaultFolder,
    folderScanInterval,
    sshAlias,
    tempProjectSettings,
  });
}

export async function deleteScope(id: string): Promise<void> {
  return invoke("delete_scope", { id });
}

export async function reorderScopes(scopeIds: string[]): Promise<void> {
  return invoke("reorder_scopes", { scopeIds });
}

// Scope Links
export async function createScopeLink(
  request: CreateScopeLinkRequest
): Promise<ScopeLink> {
  return invoke("create_scope_link", { request });
}

export async function deleteScopeLink(id: string): Promise<void> {
  return invoke("delete_scope_link", { id });
}

// Projects
export async function getProjects(
  scopeId: string
): Promise<ProjectWithStatus[]> {
  return invoke("get_projects", { scopeId });
}

export async function getAllProjects(): Promise<ProjectWithStatus[]> {
  return invoke("get_all_projects");
}

export async function createProject(
  request: CreateProjectRequest
): Promise<Project> {
  return invoke("create_project", { request });
}

export async function getProject(id: string): Promise<ProjectWithStatus> {
  return invoke("get_project", { id });
}

export async function updateProject(
  id: string,
  name?: string,
  preferredEditorId?: string,
  defaultBranch?: string,
  workspaceFile?: string
): Promise<void> {
  return invoke("update_project", {
    id,
    name,
    preferredEditorId,
    defaultBranch,
    workspaceFile,
  });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

export async function deleteProjectWithFolder(id: string): Promise<void> {
  return invoke("delete_project_with_folder", { id });
}

export async function updateProjectLastOpened(id: string): Promise<void> {
  return invoke("update_project_last_opened", { id });
}

export async function moveProjectToScope(
  projectId: string,
  newScopeId: string
): Promise<void> {
  return invoke("move_project_to_scope", {
    projectId,
    newScopeId,
  });
}

export async function moveProjectToScopeWithFolder(
  projectId: string,
  newScopeId: string,
  targetFolder?: string,
  folderName?: string
): Promise<string> {
  return invoke("move_project_to_scope_with_folder", {
    projectId,
    newScopeId,
    targetFolder,
    folderName,
  });
}

// Project Tags
export async function addProjectTag(
  projectId: string,
  tag: string
): Promise<void> {
  return invoke("add_project_tag", { projectId, tag });
}

export async function removeProjectTag(
  projectId: string,
  tag: string
): Promise<void> {
  return invoke("remove_project_tag", { projectId, tag });
}

// Folder Scanning
export async function scanFolderForProjects(
  folderPath: string
): Promise<string[]> {
  return invoke("scan_folder_for_projects", { folderPath });
}

// Project Links
export async function createProjectLink(
  request: CreateProjectLinkRequest
): Promise<ProjectLink> {
  return invoke("create_project_link", { request });
}

export async function deleteProjectLink(id: string): Promise<void> {
  return invoke("delete_project_link", { id });
}

export async function getProjectLinks(
  projectId: string
): Promise<ProjectLink[]> {
  return invoke("get_project_links", { projectId });
}

// Project Groups
export async function createProjectGroup(
  request: CreateProjectGroupRequest
): Promise<ProjectGroup> {
  return invoke("create_project_group", { request });
}

export async function updateProjectGroup(
  groupId: string,
  name?: string,
  color?: string
): Promise<void> {
  return invoke("update_project_group", { groupId, name, color });
}

export async function deleteProjectGroup(groupId: string): Promise<void> {
  return invoke("delete_project_group", { groupId });
}

export async function getProjectGroups(scopeId: string): Promise<ProjectGroup[]> {
  return invoke("get_project_groups", { scopeId });
}

export async function assignProjectToGroup(
  projectId: string,
  groupId: string | null
): Promise<void> {
  return invoke("assign_project_to_group", { projectId, groupId });
}

// Project Commands
export async function createProjectCommand(
  request: CreateProjectCommandRequest
): Promise<ProjectCommand> {
  return invoke("create_project_command", { request });
}

export async function updateProjectCommand(
  commandId: string,
  name?: string,
  command?: string,
  description?: string,
  workingDirectory?: string
): Promise<void> {
  return invoke("update_project_command", {
    commandId,
    name,
    command,
    description,
    workingDirectory,
  });
}

export async function deleteProjectCommand(commandId: string): Promise<void> {
  return invoke("delete_project_command", { commandId });
}

export async function getProjectCommands(
  projectId: string
): Promise<ProjectCommand[]> {
  return invoke("get_project_commands", { projectId });
}

export async function executeProjectCommand(
  commandId: string,
  projectPath: string
): Promise<string> {
  return invoke("execute_project_command", { commandId, projectPath });
}

// Project Metadata
export async function updateProjectNotes(
  projectId: string,
  notes: string | null
): Promise<void> {
  return invoke("update_project_notes", { projectId, notes });
}

export async function updateProjectDescription(
  projectId: string,
  description: string | null
): Promise<void> {
  return invoke("update_project_description", { projectId, description });
}

export async function pinProject(projectId: string): Promise<void> {
  return invoke("pin_project", { projectId });
}

export async function unpinProject(projectId: string): Promise<void> {
  return invoke("unpin_project", { projectId });
}

// Project Statistics
export async function getProjectStatistics(
  projectPath: string
): Promise<ProjectStatistics> {
  return invoke("get_project_statistics", { projectPath });
}

// Terminal
export async function openTerminal(
  projectPath: string,
  execTemplate?: string
): Promise<void> {
  return invoke("open_terminal", { projectPath, execTemplate });
}

// Terminals
export async function detectTerminals(): Promise<TerminalInfo[]> {
  return invoke("detect_terminals");
}

export async function syncTerminals(): Promise<Terminal[]> {
  return invoke("sync_terminals");
}

export async function getTerminals(): Promise<Terminal[]> {
  return invoke("get_terminals");
}

// Git
export async function getGitStatus(projectPath: string): Promise<{
  branch: string | null;
  ahead: number;
  behind: number;
  has_uncommitted: boolean;
  has_untracked: boolean;
  remote_url: string | null;
}> {
  return invoke("get_git_status", { projectPath });
}

export async function refreshGitStatus(
  projectId: string,
  projectPath: string
): Promise<GitStatusCache> {
  return invoke("refresh_git_status", {
    projectId,
    projectPath,
  });
}

export async function gitPull(projectPath: string): Promise<string> {
  return invoke("git_pull", { projectPath });
}

export async function gitPush(projectPath: string): Promise<string> {
  return invoke("git_push", { projectPath });
}

export async function getGitBranches(projectPath: string): Promise<
  Array<{
    name: string;
    isRemote: boolean;
    isCurrent: boolean;
  }>
> {
  return invoke("get_git_branches", { projectPath });
}

export async function getGitConfig(projectPath: string): Promise<{
  userName: string | null;
  userEmail: string | null;
  remotes: Array<{ name: string; url: string }>;
}> {
  return invoke("get_git_config", { projectPath });
}

export async function gitGc(projectPath: string): Promise<string> {
  return invoke("git_gc", { projectPath });
}

export async function gitFetch(projectPath: string): Promise<string> {
  return invoke("git_fetch", { projectPath });
}

// Editors
export async function detectEditors(): Promise<EditorInfo[]> {
  return invoke("detect_editors");
}

export async function syncEditors(): Promise<Editor[]> {
  return invoke("sync_editors");
}

export async function getEditors(): Promise<Editor[]> {
  return invoke("get_editors");
}

export async function addEditor(
  name: string,
  command: string,
  icon?: string
): Promise<Editor> {
  return invoke("add_editor", { name, command, icon });
}

export async function openInEditor(
  editorCommand: string,
  projectPath: string,
  workspaceFile?: string
): Promise<void> {
  return invoke("open_in_editor", {
    editorCommand,
    projectPath,
    workspaceFile,
  });
}

export async function findWorkspaceFiles(
  projectPath: string
): Promise<string[]> {
  return invoke("find_workspace_files", { projectPath });
}

// Settings
export async function getSetting<T>(key: string): Promise<T | null> {
  return invoke("get_setting", { key });
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  return invoke("get_all_settings");
}

// Temp Projects
export async function createTempProject(
  request: TempProjectRequest
): Promise<TempProjectResult> {
  return invoke("create_temp_project", { request });
}

export async function onTempProjectProgress(
  callback: (progress: TempProjectProgress) => void
): Promise<UnlistenFn> {
  return listen("temp-project-progress", (event) => {
    callback(event.payload as TempProjectProgress);
  });
}

export async function checkTempFolderExists(
  scopeId: string,
  folderName: string
): Promise<boolean> {
  return invoke("check_folder_exists", { scopeId, folderName });
}

// Folder Scanner
export async function scanScopeFolder(scopeId: string): Promise<string[]> {
  return invoke("scan_scope_folder", { scopeId });
}

export async function moveProjectToScopeFolder(
  projectId: string
): Promise<string> {
  return invoke("move_project_to_scope_folder", { projectId });
}

// Git Config
export async function readGitIncludeIfs(): Promise<GitIncludeIf[]> {
  return invoke("read_git_include_ifs");
}

export async function getScopeGitIdentity(
  scopeId: string
): Promise<ScopeGitConfig | null> {
  return invoke("get_scope_git_identity", { scopeId });
}

export async function createGitIncludeIf(
  scopeFolder: string,
  configPath: string
): Promise<void> {
  return invoke("create_git_include_if", { scopeFolder, configPath });
}

export async function createScopeGitConfigFile(
  scopeId: string,
  userName: string,
  userEmail: string,
  gpgSigningMethod: GpgSigningMethod,
  signingKey?: string | null,
  rawGpgConfig?: string | null
): Promise<string> {
  return invoke("create_scope_git_config_file", {
    scopeId,
    userName,
    userEmail,
    gpgSigningMethod,
    signingKey,
    rawGpgConfig,
  });
}

export async function refreshScopeGitIdentity(scopeId: string): Promise<void> {
  return invoke("refresh_scope_git_identity", { scopeId });
}

export async function discoverScopeGitConfig(
  scopeId: string
): Promise<ScopeGitConfig | null> {
  return invoke("discover_scope_git_config", { scopeId });
}

// SSH Config
export async function readSshAliases(): Promise<SshAlias[]> {
  return invoke("read_ssh_aliases");
}

export async function getSshAliasDetails(
  host: string
): Promise<SshAlias | null> {
  return invoke("get_ssh_alias_details", { host });
}

export async function createSshAlias(
  request: CreateSshAliasRequest
): Promise<SshAlias> {
  return invoke("create_ssh_alias", { request });
}

// Git URL Parsing
export async function parseGitUrl(
  url: string,
  knownAliases: string[]
): Promise<ParsedGitUrl> {
  return invoke("parse_git_url", { url, knownAliases });
}

// Clone Repository
export async function checkFolderExists(
  scopeId: string,
  folderName: string
): Promise<boolean> {
  return invoke("check_folder_exists", { scopeId, folderName });
}

export async function cloneRepository(
  scopeId: string,
  url: string,
  folderName: string,
  options: CloneOptions
): Promise<CloneResult> {
  return invoke("clone_repository", {
    scopeId,
    url,
    folderName,
    options,
  });
}

export function onCloneProgress(
  callback: (progress: CloneProgress) => void
): Promise<UnlistenFn> {
  return listen<CloneProgress>("clone-progress", (event) => {
    callback(event.payload);
  });
}

// Diagnostics
import type {
  DiagnosticIssue,
  DiagnosticFix,
  DisabledRule,
  RuleMetadata,
  ScanState,
  ScopeDiagnosticsSummary,
} from "../types";

export async function getScopeDiagnostics(
  scopeId: string,
  includeDismissed: boolean = false
): Promise<DiagnosticIssue[]> {
  return invoke("get_scope_diagnostics", { scopeId, includeDismissed });
}

export async function getDiagnosticsSummaries(): Promise<ScopeDiagnosticsSummary[]> {
  return invoke("get_diagnostics_summaries");
}

export async function getScopeDiagnosticsSummary(
  scopeId: string
): Promise<ScopeDiagnosticsSummary> {
  return invoke("get_scope_diagnostics_summary", { scopeId });
}

export async function scanScopeDiagnostics(scopeId: string): Promise<ScanState> {
  return invoke("scan_scope_diagnostics", { scopeId });
}

export async function dismissDiagnostic(issueId: string): Promise<void> {
  return invoke("dismiss_diagnostic", { issueId });
}

export async function undismissDiagnostic(issueId: string): Promise<void> {
  return invoke("undismiss_diagnostic", { issueId });
}

export async function disableDiagnosticRule(
  ruleId: string,
  scopeId?: string
): Promise<void> {
  return invoke("disable_diagnostic_rule", { ruleId, scopeId });
}

export async function enableDiagnosticRule(
  ruleId: string,
  scopeId?: string
): Promise<void> {
  return invoke("enable_diagnostic_rule", { ruleId, scopeId });
}

export async function getDisabledDiagnosticRules(): Promise<DisabledRule[]> {
  return invoke("get_disabled_diagnostic_rules");
}

export async function getDiagnosticRuleMetadata(): Promise<RuleMetadata[]> {
  return invoke("get_diagnostic_rule_metadata");
}

export async function fixDiagnosticIssue(fix: DiagnosticFix): Promise<void> {
  return invoke("fix_diagnostic_issue", { fix });
}
