export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface TempProjectSettings {
  cleanupDays: number;
  setupGitIdentity: boolean;
  preferredPackageManager: PackageManager;
}

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
  // Max features
  defaultFolder: string | null;
  folderScanInterval: number | null;
  sshAlias: string | null;
  // Temp project settings
  tempProjectSettings: TempProjectSettings | null;
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
  defaultFolder?: string | null;
  sshAlias?: string | null;
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

// Auto-detect link type from URL
export function detectLinkType(url: string): LinkType {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("github.com") || hostname.includes("github.")) return "github";
    if (hostname.includes("gitlab.com") || hostname.includes("gitlab.")) return "gitlab";
    if (hostname.includes("bitbucket.org") || hostname.includes("bitbucket.")) return "bitbucket";
    if (hostname.includes("atlassian.net") && url.includes("/jira")) return "jira";
    if (hostname.includes("jira.")) return "jira";
    if (hostname.includes("atlassian.net") && url.includes("/wiki")) return "confluence";
    if (hostname.includes("confluence.")) return "confluence";
    if (hostname.includes("notion.so") || hostname.includes("notion.site")) return "notion";
    if (hostname.includes("linear.app")) return "linear";
    if (hostname.includes("slack.com")) return "slack";
  } catch {
    // Invalid URL, return custom
  }
  return "custom";
}

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

// Max Features Types

export interface IgnoredFolderWarning {
  id: string;
  scopeId: string;
  projectPath: string;
  createdAt: string;
}

export type GpgSigningMethod = "none" | "manual" | "password_manager";

export interface ScopeGitConfig {
  scopeId: string;
  userName: string | null;
  userEmail: string | null;
  gpgSign: boolean;
  gpgSigningMethod: GpgSigningMethod | null;
  signingKey: string | null;
  rawGpgConfig: string | null;
  configFilePath: string | null;
  lastCheckedAt: string | null;
}

export interface ProjectConfigIssue {
  id: string;
  projectId: string;
  issueType: "git_name" | "git_email" | "git_gpg" | "ssh_remote" | "folder_outside";
  expectedValue: string | null;
  actualValue: string | null;
  dismissed: boolean;
  createdAt: string;
}

export interface SshAlias {
  host: string;
  hostName: string | null;
  user: string | null;
  identityFile: string | null;
}

export interface GitIncludeIf {
  condition: string;
  path: string;
}

export interface CreateSshAliasRequest {
  host: string;
  hostName: string;
  user?: string | null;
  identityFile?: string | null;
  publicKey?: string | null;
}

export interface CreateGitConfigRequest {
  scopeId: string;
  userName: string;
  userEmail: string;
  gpgSigningMethod: GpgSigningMethod;
  signingKey?: string | null;
  rawGpgConfig?: string | null;
}

export interface ProjectFolderWarning {
  projectId: string;
  projectName: string;
  projectPath: string;
}

export interface ConfigMismatch {
  issueType: string;
  expectedValue: string | null;
  actualValue: string | null;
}

export interface SshRemoteMismatch {
  projectId: string;
  expectedAlias: string;
  actualUrl: string;
}

// Clone Repository Types

export interface ParsedGitUrl {
  protocol: "ssh" | "http" | "https";
  host: string;
  port?: number;
  user?: string;
  hasHttpCredentials: boolean;
  owner: string;
  repo: string;
  usesAlias?: string;
  originalUrl: string;
}

export interface CloneOptions {
  useSshAlias?: string;
  branch?: string;
  shallow: boolean;
}

export interface CloneProgress {
  line: string;
  isError: boolean;
  status?: string;
}

export interface CloneResult {
  success: boolean;
  projectId?: string;
  projectPath?: string;
  error?: string;
}

// Temp Project Types

export interface TempProjectRequest {
  scopeId: string;
  name: string;
  packageManager: PackageManager;
  template: string;
  options?: TempProjectOptions;
}

export interface TempProjectOptions {
  // Next.js options
  nextjs?: {
    router: "app" | "pages";
    typescript: boolean;
    tailwind: boolean;
    eslint: boolean;
    srcDir: boolean;
  };
  // Astro options
  astro?: {
    template: "basics" | "blog" | "minimal";
    typescript: "strict" | "strictest" | "relaxed";
  };
  // SvelteKit options
  sveltekit?: {
    typescript: boolean;
    eslint: boolean;
    prettier: boolean;
    playwright: boolean;
    vitest: boolean;
  };
  // Solid options
  solid?: {
    ssr: boolean;
  };
  // Nest options
  nest?: {
    strict: boolean;
  };
  // Remix options
  remix?: {
    typescript: boolean;
  };
}

export interface TempProjectProgress {
  line: string;
  isError: boolean;
  status?: string;
}

export interface TempProjectResult {
  success: boolean;
  projectId?: string;
  projectPath?: string;
  error?: string;
}
