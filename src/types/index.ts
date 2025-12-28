export interface Scope {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  defaultEditorId: string | null;
  settings: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScopeLink {
  id: string;
  scopeId: string;
  linkType: string;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface ScopeWithLinks {
  scope: Scope;
  links: ScopeLink[];
}

export interface Project {
  id: string;
  scopeId: string;
  name: string;
  path: string;
  preferredEditorId: string | null;
  isTemp: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitStatusCache {
  projectId: string;
  branch: string | null;
  ahead: number;
  behind: number;
  hasUncommitted: boolean;
  hasUntracked: boolean;
  lastCheckedAt: string | null;
  remoteUrl: string | null;
}

export interface ProjectWithStatus {
  project: Project;
  tags: string[];
  gitStatus: GitStatusCache | null;
}

export interface Editor {
  id: string;
  name: string;
  command: string;
  icon: string | null;
  isAutoDetected: boolean;
  isAvailable: boolean;
  createdAt: string;
}

export interface EditorInfo {
  name: string;
  command: string;
  icon: string | null;
}

export interface CreateScopeRequest {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface CreateProjectRequest {
  scopeId: string;
  name: string;
  path: string;
  isTemp?: boolean;
}

export interface CreateScopeLinkRequest {
  scopeId: string;
  linkType: string;
  label: string;
  url: string;
}

export const LINK_TYPES = [
  { id: "github", label: "GitHub", icon: "github" },
  { id: "gitlab", label: "GitLab", icon: "gitlab" },
  { id: "bitbucket", label: "Bitbucket", icon: "bitbucket" },
  { id: "jira", label: "Jira", icon: "jira" },
  { id: "confluence", label: "Confluence", icon: "book-open" },
  { id: "notion", label: "Notion", icon: "file-text" },
  { id: "linear", label: "Linear", icon: "layout-list" },
  { id: "slack", label: "Slack", icon: "message-square" },
  { id: "custom", label: "Custom", icon: "link" },
] as const;

export type LinkType = (typeof LINK_TYPES)[number]["id"];

export const SCOPE_COLORS = [
  { id: "blue", value: "#3b82f6" },
  { id: "green", value: "#22c55e" },
  { id: "purple", value: "#a855f7" },
  { id: "orange", value: "#f97316" },
  { id: "pink", value: "#ec4899" },
  { id: "cyan", value: "#06b6d4" },
  { id: "red", value: "#ef4444" },
  { id: "yellow", value: "#eab308" },
] as const;
