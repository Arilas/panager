import { invoke } from "@tauri-apps/api/core";
import type {
  ConfigMismatch,
  CreateProjectRequest,
  CreateScopeLinkRequest,
  CreateScopeRequest,
  CreateSshAliasRequest,
  Editor,
  EditorInfo,
  GitIncludeIf,
  GitStatusCache,
  GpgSigningMethod,
  IgnoredFolderWarning,
  Project,
  ProjectFolderWarning,
  ProjectWithStatus,
  Scope,
  ScopeGitConfig,
  ScopeLink,
  ScopeWithLinks,
  SshAlias,
  SshRemoteMismatch,
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
  sshAlias?: string
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

export async function updateProject(
  id: string,
  name?: string,
  preferredEditorId?: string
): Promise<void> {
  return invoke("update_project", {
    id,
    name,
    preferredEditorId,
  });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
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

export async function deleteEditor(id: string): Promise<void> {
  return invoke("delete_editor", { id });
}

export async function openInEditor(
  editorCommand: string,
  projectPath: string
): Promise<void> {
  return invoke("open_in_editor", {
    editorCommand,
    projectPath,
  });
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
export interface TempProjectRequest {
  name: string;
  packageManager: string;
  template: string;
  basePath?: string;
}

export interface TempProjectResult {
  path: string;
  success: boolean;
  message: string;
}

export async function createTempProject(
  request: TempProjectRequest
): Promise<TempProjectResult> {
  return invoke("create_temp_project", { request });
}

export async function getTempProjectsPath(): Promise<string> {
  return invoke("get_temp_projects_path");
}

// Folder Scanner
export async function getProjectsOutsideFolder(
  scopeId: string
): Promise<ProjectFolderWarning[]> {
  return invoke("get_projects_outside_folder", { scopeId });
}

export async function ignoreFolderWarning(
  scopeId: string,
  projectPath: string
): Promise<void> {
  return invoke("ignore_folder_warning", { scopeId, projectPath });
}

export async function removeIgnoredWarning(id: string): Promise<void> {
  return invoke("remove_ignored_warning", { id });
}

export async function getIgnoredWarnings(
  scopeId: string
): Promise<IgnoredFolderWarning[]> {
  return invoke("get_ignored_warnings", { scopeId });
}

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

export async function verifyProjectGitConfig(
  projectId: string
): Promise<ConfigMismatch[]> {
  return invoke("verify_project_git_config", { projectId });
}

export async function fixProjectGitConfig(
  projectId: string,
  configKey: string,
  value: string
): Promise<void> {
  return invoke("fix_project_git_config", { projectId, configKey, value });
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

export async function verifyProjectSshRemote(
  projectId: string
): Promise<SshRemoteMismatch | null> {
  return invoke("verify_project_ssh_remote", { projectId });
}

export async function fixProjectSshRemote(projectId: string): Promise<string> {
  return invoke("fix_project_ssh_remote", { projectId });
}
