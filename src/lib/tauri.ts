import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProjectRequest,
  CreateScopeLinkRequest,
  CreateScopeRequest,
  Editor,
  EditorInfo,
  GitStatusCache,
  Project,
  ProjectWithStatus,
  Scope,
  ScopeLink,
  ScopeWithLinks,
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
  defaultEditorId?: string
): Promise<void> {
  return invoke("update_scope", {
    id,
    name,
    color,
    icon,
    defaultEditorId,
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
