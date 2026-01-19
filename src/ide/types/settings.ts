/**
 * IDE Settings Type Definitions
 *
 * These types define the structure of IDE settings stored in .panager/ide-settings.jsonc files.
 * Settings are loaded and merged by the Rust backend in order: user → scope → workspace.
 */

/** Settings level for the three-tier configuration hierarchy */
export type SettingsLevel = "user" | "scope" | "workspace";

/** Activity bar position options */
export type ActivityBarPosition = "left" | "right" | "hidden";

/** Sidebar position options */
export type SidebarPosition = "left" | "right";

/** Git changes view mode */
export type GitViewMode = "tree" | "list";

/** Word wrap options (matches Monaco) */
export type WordWrap = "off" | "on" | "wordWrapColumn" | "bounded";

/** Line numbers options (matches Monaco) */
export type LineNumbers = "on" | "off" | "relative" | "interval";

/** Whitespace rendering options (matches Monaco) */
export type RenderWhitespace = "none" | "boundary" | "selection" | "trailing" | "all";

/** Cursor blinking style (matches Monaco) */
export type CursorBlinking = "blink" | "smooth" | "phase" | "expand" | "solid";

/** Cursor style (matches Monaco) */
export type CursorStyle = "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";

// =============================================================================
// General Settings
// =============================================================================

/** Activity bar settings */
export interface ActivityBarSettings {
  position: ActivityBarPosition;
}

/** Sidebar settings */
export interface SidebarSettings {
  position: SidebarPosition;
}

/** General git settings (different from GitSettings which is for git features) */
export interface GitGeneralSettings {
  defaultView: GitViewMode;
}

export interface GeneralSettings {
  /** Activity bar configuration */
  activityBar: ActivityBarSettings;
  /** Sidebar configuration */
  sidebar: SidebarSettings;
  /** Default git view mode for changes panel */
  git: GitGeneralSettings;
}

// =============================================================================
// Editor Settings
// =============================================================================

/** Minimap settings */
export interface MinimapSettings {
  enabled: boolean;
  side: "left" | "right";
}

/** Bracket pair colorization settings */
export interface BracketPairColorizationSettings {
  enabled: boolean;
}

/** Editor guides settings */
export interface GuidesSettings {
  bracketPairs: boolean | "active";
  indentation: boolean;
}

/** Editor padding settings */
export interface PaddingSettings {
  top: number;
  bottom: number;
}

export interface EditorSettings {
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Tab size (spaces per tab) */
  tabSize: number;
  /** Insert spaces when pressing Tab */
  insertSpaces: boolean;
  /** Word wrap mode */
  wordWrap: WordWrap;
  /** Column to wrap at when wordWrap is "wordWrapColumn" or "bounded" */
  wordWrapColumn: number;
  /** Line numbers display mode */
  lineNumbers: LineNumbers;
  /** Minimap configuration */
  minimap: MinimapSettings;
  /** Render whitespace characters */
  renderWhitespace: RenderWhitespace;
  /** Bracket pair colorization */
  bracketPairColorization: BracketPairColorizationSettings;
  /** Editor guides */
  guides: GuidesSettings;
  /** Cursor blinking style */
  cursorBlinking: CursorBlinking;
  /** Cursor style */
  cursorStyle: CursorStyle;
  /** Smooth caret animation */
  cursorSmoothCaretAnimation: "off" | "on" | "explicit";
  /** Enable smooth scrolling */
  smoothScrolling: boolean;
  /** Scroll beyond last line */
  scrollBeyondLastLine: boolean;
  /** Line height (0 = auto) */
  lineHeight: number;
  /** Letter spacing */
  letterSpacing: number;
  /** Editor padding */
  padding: PaddingSettings;
}

/** Language-specific editor overrides */
export interface LanguageEditorOverrides {
  tabSize?: number;
  insertSpaces?: boolean;
  wordWrap?: WordWrap;
  formatOnSave?: boolean;
  trimTrailingWhitespace?: boolean;
}

// =============================================================================
// Git Settings
// =============================================================================

/** Blame settings */
export interface BlameSettings {
  enabled: boolean;
}

/** CodeLens settings */
export interface CodeLensSettings {
  enabled: boolean;
}

/** Gutter settings */
export interface GutterSettings {
  enabled: boolean;
}

export interface GitSettings {
  /** Inline blame annotations */
  blame: BlameSettings;
  /** Code lens with commit info above functions */
  codeLens: CodeLensSettings;
  /** Change indicators in gutter */
  gutter: GutterSettings;
  /** Automatically refresh git status */
  autoRefresh: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval: number;
}

// =============================================================================
// Behavior Settings
// =============================================================================

/** Formatter configuration */
export interface FormatterConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Command to execute. Placeholders: {file}, {dir}, {basename}, {ext} */
  command: string;
  /** Languages this formatter applies to */
  languages: string[];
  /** Whether this formatter is enabled */
  enabled: boolean;
  /** Execution order (lower = runs first) */
  order: number;
}

/** Format on save settings */
export interface FormatOnSaveSettings {
  /** Enable format on save */
  enabled: boolean;
  /** Configured formatters */
  formatters: FormatterConfig[];
}

export interface BehaviorSettings {
  /** Format on save configuration */
  formatOnSave: FormatOnSaveSettings;
  /** Trim trailing whitespace on save */
  trimTrailingWhitespace: boolean;
  /** Insert final newline at end of file */
  insertFinalNewline: boolean;
  /** Auto save delay in milliseconds (0 = disabled) */
  autoSaveDelay: number;
}

// =============================================================================
// Complete IDE Settings
// =============================================================================

export interface IdeSettings {
  /** General UI settings */
  general: GeneralSettings;
  /** Editor (Monaco) settings */
  editor: EditorSettings;
  /** Language-specific editor overrides, keyed by language ID like "[typescript]" */
  languageOverrides: Record<string, LanguageEditorOverrides>;
  /** Git integration settings */
  git: GitSettings;
  /** Save behavior settings */
  behavior: BehaviorSettings;
}

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_FORMATTER_PRESETS: Omit<FormatterConfig, "order">[] = [
  {
    id: "eslint",
    name: "ESLint",
    command: "npx eslint --fix {file}",
    languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    enabled: false,
  },
  {
    id: "prettier",
    name: "Prettier",
    command: "npx prettier --write {file}",
    languages: ["javascript", "typescript", "javascriptreact", "typescriptreact", "json", "css", "scss", "html", "markdown", "yaml"],
    enabled: false,
  },
  {
    id: "oxlint",
    name: "Oxlint",
    command: "npx oxlint --fix {file}",
    languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    enabled: false,
  },
  {
    id: "oxfmt",
    name: "Oxfmt",
    command: "npx oxfmt {file}",
    languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    enabled: false,
  },
  {
    id: "biome",
    name: "Biome",
    command: "npx biome format --write {file}",
    languages: ["javascript", "typescript", "javascriptreact", "typescriptreact", "json", "css"],
    enabled: false,
  },
  {
    id: "rustfmt",
    name: "rustfmt",
    command: "rustfmt {file}",
    languages: ["rust"],
    enabled: false,
  },
  {
    id: "black",
    name: "Black",
    command: "black {file}",
    languages: ["python"],
    enabled: false,
  },
  {
    id: "gofmt",
    name: "gofmt",
    command: "gofmt -w {file}",
    languages: ["go"],
    enabled: false,
  },
];

export const DEFAULT_IDE_SETTINGS: IdeSettings = {
  general: {
    activityBar: { position: "left" },
    sidebar: { position: "left" },
    git: { defaultView: "tree" },
  },
  editor: {
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "off",
    wordWrapColumn: 80,
    lineNumbers: "on",
    minimap: { enabled: true, side: "right" },
    renderWhitespace: "selection",
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: "active", indentation: true },
    cursorBlinking: "smooth",
    cursorStyle: "line",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    lineHeight: 0,
    letterSpacing: 0,
    padding: { top: 8, bottom: 0 },
  },
  languageOverrides: {},
  git: {
    blame: { enabled: true },
    codeLens: { enabled: true },
    gutter: { enabled: true },
    autoRefresh: true,
    refreshInterval: 30000,
  },
  behavior: {
    formatOnSave: {
      enabled: false,
      formatters: [],
    },
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    autoSaveDelay: 0,
  },
};

// =============================================================================
// Utility Types
// =============================================================================

/** Deep partial type for settings at a specific level */
export type PartialIdeSettings = {
  general?: Partial<GeneralSettings>;
  editor?: Partial<EditorSettings>;
  languageOverrides?: Record<string, Partial<LanguageEditorOverrides>>;
  git?: Partial<GitSettings>;
  behavior?: Partial<BehaviorSettings>;
};

/** Result from writing a file with formatters */
export interface WriteFileResult {
  success: boolean;
  /** Updated content if formatters ran (null if no formatters or formatters disabled) */
  content: string | null;
  /** Results from each formatter that ran */
  formatterResults: FormatterResult[];
}

/** Result from a single formatter execution */
export interface FormatterResult {
  formatterId: string;
  success: boolean;
  output: string | null;
  error: string | null;
  /** Execution time in milliseconds */
  durationMs: number;
}

/** Supported languages for formatters (Monaco language IDs) */
export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "json",
  "jsonc",
  "html",
  "css",
  "scss",
  "less",
  "markdown",
  "yaml",
  "toml",
  "rust",
  "go",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "sql",
  "graphql",
  "xml",
  "dockerfile",
  "shell",
  "powershell",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
