// Re-export all types from generated bindings
export type {
  // Core models
  Scope,
  ScopeLink,
  ScopeWithLinks,
  ScopeGitConfig,
  Project,
  GitStatusCache,
  ProjectWithStatus,
  Editor,
  SshAlias,
  GitIncludeIf,
  // DTOs
  CreateScopeRequest,
  CreateProjectRequest,
  CreateScopeLinkRequest,
  CreateSshAliasRequest,
  // Temp project types
  TempProjectRequest,
  TempProjectResult,
  TempProjectProgress,
  // Clone types
  CloneOptions,
  CloneResult,
  CloneProgress,
  // JSON value
  JsonValue,
  // Diagnostics
  Severity,
  RuleGroup,
  RuleMetadata,
  DiagnosticIssue,
  DiagnosticFix,
  DisabledRule,
  ScanState,
  ScopeDiagnosticsSummary,
} from "../bindings/types";

// Override TempProjectSettings to use strict PackageManager union type
import type { TempProjectSettings as BaseTempProjectSettings } from "../bindings/types";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface TempProjectSettings extends Omit<BaseTempProjectSettings, "preferredPackageManager"> {
  preferredPackageManager: PackageManager;
}

// Override ScopeGitConfig to use strict GpgSigningMethod union type
import type { ScopeGitConfig as BaseScopeGitConfig } from "../bindings/types";

export type GpgSigningMethod = "none" | "manual" | "password_manager";

// Note: Re-exported ScopeGitConfig uses string for gpgSigningMethod
// Use this refined type when stricter typing is needed
export interface ScopeGitConfigTyped extends Omit<BaseScopeGitConfig, "gpgSigningMethod"> {
  gpgSigningMethod: GpgSigningMethod | null;
}

// Frontend-only types (not from Rust)

export interface EditorInfo {
  name: string;
  command: string;
  icon: string | null;
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

export interface CreateGitConfigRequest {
  scopeId: string;
  userName: string;
  userEmail: string;
  gpgSigningMethod: GpgSigningMethod;
  signingKey?: string | null;
  rawGpgConfig?: string | null;
}

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

// Framework-specific options for temp project creation
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

// Constants

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
