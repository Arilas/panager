//! IDE Settings Module
//!
//! Handles loading, merging, and saving IDE settings from JSONC files.
//! Settings are stored at three levels: user, scope, and workspace.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

/// Settings level for the three-tier configuration hierarchy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SettingsLevel {
    User,
    Scope,
    Workspace,
}

// =============================================================================
// Settings Types
// =============================================================================

/// Activity bar position options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum ActivityBarPosition {
    #[default]
    Left,
    Right,
    Hidden,
}

/// Sidebar position options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum SidebarPosition {
    #[default]
    Left,
    Right,
}

/// Git changes view mode
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum GitViewMode {
    #[default]
    Tree,
    List,
}

/// Liquid Glass mode: true = always on, false = always off, "auto" = only on macOS 26+
#[derive(Debug, Clone, Type, Default)]
pub enum LiquidGlassMode {
    On,
    Off,
    #[default]
    Auto,
}

impl serde::Serialize for LiquidGlassMode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            LiquidGlassMode::On => serializer.serialize_bool(true),
            LiquidGlassMode::Off => serializer.serialize_bool(false),
            LiquidGlassMode::Auto => serializer.serialize_str("auto"),
        }
    }
}

impl<'de> serde::Deserialize<'de> for LiquidGlassMode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::{self, Visitor};

        struct LiquidGlassModeVisitor;

        impl<'de> Visitor<'de> for LiquidGlassModeVisitor {
            type Value = LiquidGlassMode;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a boolean or the string \"auto\"")
            }

            fn visit_bool<E>(self, value: bool) -> Result<LiquidGlassMode, E>
            where
                E: de::Error,
            {
                Ok(if value {
                    LiquidGlassMode::On
                } else {
                    LiquidGlassMode::Off
                })
            }

            fn visit_str<E>(self, value: &str) -> Result<LiquidGlassMode, E>
            where
                E: de::Error,
            {
                match value.to_lowercase().as_str() {
                    "true" | "on" => Ok(LiquidGlassMode::On),
                    "false" | "off" => Ok(LiquidGlassMode::Off),
                    "auto" => Ok(LiquidGlassMode::Auto),
                    _ => Err(de::Error::unknown_variant(value, &["true", "false", "auto"])),
                }
            }
        }

        deserializer.deserialize_any(LiquidGlassModeVisitor)
    }
}

/// Liquid Glass intensity options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum LiquidGlassIntensity {
    Subtle,
    #[default]
    Medium,
    Strong,
}

/// Word wrap options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub enum WordWrap {
    #[default]
    Off,
    On,
    WordWrapColumn,
    Bounded,
}

/// Line numbers options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum LineNumbers {
    #[default]
    On,
    Off,
    Relative,
    Interval,
}

/// Whitespace rendering options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum RenderWhitespace {
    None,
    Boundary,
    #[default]
    Selection,
    Trailing,
    All,
}

/// Cursor blinking style
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum CursorBlinking {
    Blink,
    #[default]
    Smooth,
    Phase,
    Expand,
    Solid,
}

/// Cursor style
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "kebab-case")]
pub enum CursorStyle {
    #[default]
    Line,
    Block,
    Underline,
    LineThin,
    BlockOutline,
    UnderlineThin,
}

/// Cursor smooth caret animation
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum CursorSmoothCaretAnimation {
    Off,
    #[default]
    On,
    Explicit,
}

/// Bracket pairs guides mode
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum BracketPairsGuides {
    #[serde(rename = "true")]
    True,
    #[serde(rename = "false")]
    False,
    #[default]
    Active,
}

/// Minimap side
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum MinimapSide {
    Left,
    #[default]
    Right,
}

/// Parameter name hints display mode
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum ParameterNameHints {
    /// Never show parameter name hints
    None,
    /// Show hints only for literal arguments
    #[default]
    Literals,
    /// Always show parameter name hints
    All,
}

/// Agent mode for Claude Code interactions
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    Plan,
    #[default]
    Agent,
    Ask,
}

/// Approval mode for file changes
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalMode {
    #[default]
    PerChange,
    Batch,
    Auto,
}

// =============================================================================
// Settings Structures
// =============================================================================

/// Activity bar settings (nested under general)
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ActivityBarSettings {
    #[serde(default)]
    pub position: ActivityBarPosition,
}

/// Sidebar settings (nested under general)
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SidebarSettings {
    #[serde(default)]
    pub position: SidebarPosition,
}

/// Git general settings (nested under general)
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct GitGeneralSettings {
    #[serde(default)]
    pub default_view: GitViewMode,
}

/// Appearance settings for visual effects
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearanceSettings {
    /// Liquid Glass effect mode
    #[serde(default)]
    pub liquid_glass_mode: LiquidGlassMode,
    /// Liquid Glass blur intensity
    #[serde(default)]
    pub liquid_glass_intensity: LiquidGlassIntensity,
    /// Accent color for the UI (hex format, e.g., "#3b82f6")
    #[serde(default = "default_accent_color")]
    pub accent_color: String,
}

fn default_accent_color() -> String {
    "#3b82f6".to_string() // Blue-500
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            liquid_glass_mode: LiquidGlassMode::Auto,
            liquid_glass_intensity: LiquidGlassIntensity::Medium,
            accent_color: default_accent_color(),
        }
    }
}

/// General settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneralSettings {
    #[serde(default)]
    pub activity_bar: ActivityBarSettings,
    #[serde(default)]
    pub sidebar: SidebarSettings,
    #[serde(default)]
    pub git: GitGeneralSettings,
    /// Appearance and theme settings
    #[serde(default)]
    pub appearance: AppearanceSettings,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            activity_bar: ActivityBarSettings {
                position: ActivityBarPosition::Left,
            },
            sidebar: SidebarSettings {
                position: SidebarPosition::Left,
            },
            git: GitGeneralSettings {
                default_view: GitViewMode::Tree,
            },
            appearance: AppearanceSettings::default(),
        }
    }
}

/// Minimap settings (nested under editor)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct MinimapSettings {
    pub enabled: bool,
    pub side: MinimapSide,
}

impl Default for MinimapSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            side: MinimapSide::Right,
        }
    }
}

/// Bracket pair colorization settings (nested under editor)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct BracketPairColorizationSettings {
    pub enabled: bool,
}

impl Default for BracketPairColorizationSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

/// Guide settings (nested under editor)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GuidesSettings {
    pub bracket_pairs: BracketPairsGuides,
    pub indentation: bool,
}

impl Default for GuidesSettings {
    fn default() -> Self {
        Self {
            bracket_pairs: BracketPairsGuides::Active,
            indentation: true,
        }
    }
}

/// Padding settings (nested under editor)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct PaddingSettings {
    pub top: u32,
    pub bottom: u32,
}

impl Default for PaddingSettings {
    fn default() -> Self {
        Self { top: 8, bottom: 0 }
    }
}

/// Inlay hints settings (nested under editor)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct InlayHintsSettings {
    /// Master toggle for all inlay hints
    pub enabled: bool,
    /// When to show parameter name hints
    pub parameter_names: ParameterNameHints,
    /// Suppress parameter hints when argument matches the parameter name
    pub parameter_names_when_argument_matches_name: bool,
    /// Show type hints for parameters
    pub parameter_types: bool,
    /// Show type hints for variable declarations
    pub variable_types: bool,
    /// Show type hints for property declarations
    pub property_declaration_types: bool,
    /// Show return type hints for functions
    pub function_return_types: bool,
    /// Show values for enum members
    pub enum_member_values: bool,
}

impl Default for InlayHintsSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            parameter_names: ParameterNameHints::Literals,
            parameter_names_when_argument_matches_name: false,
            parameter_types: false,
            variable_types: false,
            property_declaration_types: false,
            function_return_types: true,
            enum_member_values: true,
        }
    }
}

/// Editor settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct EditorSettings {
    pub font_size: u32,
    pub font_family: String,
    pub tab_size: u32,
    pub insert_spaces: bool,
    pub word_wrap: WordWrap,
    pub word_wrap_column: u32,
    pub line_numbers: LineNumbers,
    #[serde(default)]
    pub minimap: MinimapSettings,
    pub render_whitespace: RenderWhitespace,
    #[serde(default)]
    pub bracket_pair_colorization: BracketPairColorizationSettings,
    #[serde(default)]
    pub guides: GuidesSettings,
    #[serde(default)]
    pub inlay_hints: InlayHintsSettings,
    pub cursor_blinking: CursorBlinking,
    pub cursor_style: CursorStyle,
    pub cursor_smooth_caret_animation: CursorSmoothCaretAnimation,
    pub smooth_scrolling: bool,
    pub scroll_beyond_last_line: bool,
    pub line_height: u32,
    pub letter_spacing: f32,
    #[serde(default)]
    pub padding: PaddingSettings,
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            font_size: 13,
            font_family: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace".to_string(),
            tab_size: 2,
            insert_spaces: true,
            word_wrap: WordWrap::Off,
            word_wrap_column: 80,
            line_numbers: LineNumbers::On,
            minimap: MinimapSettings::default(),
            render_whitespace: RenderWhitespace::Selection,
            bracket_pair_colorization: BracketPairColorizationSettings::default(),
            guides: GuidesSettings::default(),
            inlay_hints: InlayHintsSettings::default(),
            cursor_blinking: CursorBlinking::Smooth,
            cursor_style: CursorStyle::Line,
            cursor_smooth_caret_animation: CursorSmoothCaretAnimation::On,
            smooth_scrolling: true,
            scroll_beyond_last_line: false,
            line_height: 0,
            letter_spacing: 0.0,
            padding: PaddingSettings::default(),
        }
    }
}

/// Language-specific editor overrides
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct LanguageEditorOverrides {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tab_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_spaces: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_wrap: Option<WordWrap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_on_save: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trim_trailing_whitespace: Option<bool>,
}

/// Blame settings (nested under git)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct BlameSettings {
    pub enabled: bool,
}

impl Default for BlameSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

/// CodeLens settings (nested under git)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct CodeLensSettings {
    pub enabled: bool,
}

impl Default for CodeLensSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

/// Gutter settings (nested under git)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GutterSettings {
    pub enabled: bool,
}

impl Default for GutterSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

/// Git settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GitSettings {
    #[serde(default)]
    pub blame: BlameSettings,
    #[serde(default)]
    pub code_lens: CodeLensSettings,
    #[serde(default)]
    pub gutter: GutterSettings,
    pub auto_refresh: bool,
    pub refresh_interval: u32,
}

impl Default for GitSettings {
    fn default() -> Self {
        Self {
            blame: BlameSettings::default(),
            code_lens: CodeLensSettings::default(),
            gutter: GutterSettings::default(),
            auto_refresh: true,
            refresh_interval: 30000,
        }
    }
}

/// Formatter configuration
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FormatterConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    pub languages: Vec<String>,
    pub enabled: bool,
    pub order: u32,
}

/// Format on save settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
#[derive(Default)]
pub struct FormatOnSaveSettings {
    pub enabled: bool,
    pub formatters: Vec<FormatterConfig>,
}


/// Behavior settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct BehaviorSettings {
    pub format_on_save: FormatOnSaveSettings,
    pub trim_trailing_whitespace: bool,
    pub insert_final_newline: bool,
    pub auto_save_delay: u32,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            format_on_save: FormatOnSaveSettings::default(),
            trim_trailing_whitespace: true,
            insert_final_newline: true,
            auto_save_delay: 0,
        }
    }
}

/// Agent settings (Claude Code integration)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct AgentSettings {
    /// Default agent mode when starting a new session
    pub default_mode: AgentMode,
    /// How to handle approval of file changes
    pub approval_mode: ApprovalMode,
    /// Show agent thought process in chat
    pub show_thoughts: bool,
    /// Auto-connect to Claude Code when opening a project
    pub auto_connect: bool,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            default_mode: AgentMode::Agent,
            approval_mode: ApprovalMode::PerChange,
            show_thoughts: true,
            auto_connect: false,
        }
    }
}

/// Complete IDE settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
#[derive(Default)]
pub struct IdeSettings {
    pub general: GeneralSettings,
    pub editor: EditorSettings,
    #[serde(default)]
    pub language_overrides: HashMap<String, LanguageEditorOverrides>,
    pub git: GitSettings,
    pub behavior: BehaviorSettings,
    #[serde(default)]
    pub agent: AgentSettings,
}


// =============================================================================
// Partial Settings (for per-level editing)
// =============================================================================

/// Partial settings that can be set at any level
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PartialIdeSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub general: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_overrides: Option<HashMap<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub behavior: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<Value>,
}

// =============================================================================
// Write Result Types
// =============================================================================

/// Result from a single formatter execution
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FormatterResult {
    pub formatter_id: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

/// Result from writing a file with formatters
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileResult {
    pub success: bool,
    pub content: Option<String>,
    pub formatter_results: Vec<FormatterResult>,
}

// =============================================================================
// Settings File Paths
// =============================================================================

const SETTINGS_FILENAME: &str = "settings.jsonc";
const GLIDE_DIR: &str = ".glide";

/// Get the path to the user settings file
pub fn get_user_settings_path() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(GLIDE_DIR).join(SETTINGS_FILENAME)
}

/// Get the path to scope settings file
pub fn get_scope_settings_path(scope_default_folder: &str) -> PathBuf {
    Path::new(scope_default_folder)
        .join(GLIDE_DIR)
        .join(SETTINGS_FILENAME)
}

/// Get the path to workspace settings file
pub fn get_workspace_settings_path(project_path: &str) -> PathBuf {
    Path::new(project_path)
        .join(GLIDE_DIR)
        .join(SETTINGS_FILENAME)
}

// =============================================================================
// Settings Loading & Parsing
// =============================================================================

/// Parse a JSONC string (JSON with comments) into a Value
fn parse_jsonc(content: &str) -> Result<Value, String> {
    // Use json_comments to strip comments, then parse with serde_json
    let stripped = json_comments::StripComments::new(content.as_bytes());
    serde_json::from_reader(stripped).map_err(|e| format!("Failed to parse JSONC: {}", e))
}

/// Read and parse a settings file, normalizing nested objects to dotted keys
fn read_settings_file(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        debug!("Settings file does not exist: {:?}", path);
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read settings file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let mut value = parse_jsonc(&content)?;

    // Normalize nested objects to dotted keys
    // This allows both {"minimap": {"enabled": true}} and {"minimap.enabled": true}
    normalize_settings(&mut value);

    Ok(value)
}

/// Deep merge two JSON values (source into target)
fn deep_merge(target: &mut Value, source: &Value) {
    match (target, source) {
        (Value::Object(target_map), Value::Object(source_map)) => {
            for (key, source_value) in source_map {
                match target_map.get_mut(key) {
                    Some(target_value) => {
                        deep_merge(target_value, source_value);
                    }
                    None => {
                        target_map.insert(key.clone(), source_value.clone());
                    }
                }
            }
        }
        (target, source) => {
            *target = source.clone();
        }
    }
}

/// Expand dotted keys into nested objects within an object
/// E.g., {"minimap.enabled": true} -> {"minimap": {"enabled": true}}
fn expand_dotted_keys(obj: &mut Value) {
    if let Value::Object(map) = obj {
        // Collect dotted keys to expand
        let dotted_keys: Vec<(String, Value)> = map
            .iter()
            .filter(|(k, _)| k.contains('.'))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        // Remove dotted keys and expand them
        for (key, value) in dotted_keys {
            map.remove(&key);

            // Split the key and create nested structure
            let parts: Vec<&str> = key.split('.').collect();
            if parts.len() >= 2 {
                let first = parts[0];
                let rest = parts[1..].join(".");

                // Get or create the nested object
                let nested = map
                    .entry(first.to_string())
                    .or_insert_with(|| Value::Object(serde_json::Map::new()));

                if let Value::Object(nested_map) = nested {
                    // If there's more nesting, recurse
                    if parts.len() > 2 {
                        nested_map.insert(rest.clone(), value);
                        // Recursively expand
                        expand_dotted_keys(nested);
                    } else {
                        nested_map.insert(parts[1].to_string(), value);
                    }
                }
            }
        }

        // Recursively process nested objects (but not arrays)
        for value in map.values_mut() {
            if value.is_object() {
                expand_dotted_keys(value);
            }
        }
    }
}

/// Normalize settings JSON by expanding dotted keys into nested objects
/// This allows both formats to work:
/// - {"minimap.enabled": true} (flat dotted key) -> converted to nested
/// - {"minimap": {"enabled": true}} (nested object) -> kept as is
fn normalize_settings(value: &mut Value) {
    if let Value::Object(map) = value {
        // Process each top-level section (general, editor, git, behavior)
        for section_value in map.values_mut() {
            expand_dotted_keys(section_value);
        }
    }
}

/// Load and merge settings from all levels
pub fn load_merged_settings(
    project_path: &str,
    scope_default_folder: Option<&str>,
) -> Result<IdeSettings, String> {
    load_merged_settings_up_to(SettingsLevel::Workspace, project_path, scope_default_folder)
}

/// Load and merge settings up to (and including) a specific level
///
/// - User: defaults + user
/// - Scope: defaults + user + scope
/// - Workspace: defaults + user + scope + workspace
pub fn load_merged_settings_up_to(
    up_to_level: SettingsLevel,
    project_path: &str,
    scope_default_folder: Option<&str>,
) -> Result<IdeSettings, String> {
    // Start with defaults
    let defaults = serde_json::to_value(IdeSettings::default())
        .map_err(|e| format!("Failed to serialize defaults: {}", e))?;
    let mut merged = defaults;

    // Load user settings (always included for all levels)
    let user_path = get_user_settings_path();
    if user_path.exists() {
        let user_settings = read_settings_file(&user_path)?;
        debug!("Loaded user settings from {:?}", user_path);
        deep_merge(&mut merged, &user_settings);
    }

    // Stop here for User level
    if up_to_level == SettingsLevel::User {
        return serde_json::from_value(merged)
            .map_err(|e| format!("Failed to deserialize merged settings: {}", e));
    }

    // Load scope settings (if scope has default folder)
    if let Some(scope_folder) = scope_default_folder {
        let scope_path = get_scope_settings_path(scope_folder);
        if scope_path.exists() {
            let scope_settings = read_settings_file(&scope_path)?;
            debug!("Loaded scope settings from {:?}", scope_path);
            deep_merge(&mut merged, &scope_settings);
        }
    }

    // Stop here for Scope level
    if up_to_level == SettingsLevel::Scope {
        return serde_json::from_value(merged)
            .map_err(|e| format!("Failed to deserialize merged settings: {}", e));
    }

    // Load workspace settings
    let workspace_path = get_workspace_settings_path(project_path);
    if workspace_path.exists() {
        let workspace_settings = read_settings_file(&workspace_path)?;
        debug!("Loaded workspace settings from {:?}", workspace_path);
        deep_merge(&mut merged, &workspace_settings);
    }

    // Deserialize merged settings
    serde_json::from_value(merged).map_err(|e| format!("Failed to deserialize merged settings: {}", e))
}

/// Load raw settings for a specific level (for editing in settings dialog)
pub fn load_level_settings(
    level: SettingsLevel,
    project_path: Option<&str>,
    scope_default_folder: Option<&str>,
) -> Result<PartialIdeSettings, String> {
    let path = match level {
        SettingsLevel::User => get_user_settings_path(),
        SettingsLevel::Scope => {
            let folder = scope_default_folder.ok_or("Scope default folder is required for scope settings")?;
            get_scope_settings_path(folder)
        }
        SettingsLevel::Workspace => {
            let path = project_path.ok_or("Project path is required for workspace settings")?;
            get_workspace_settings_path(path)
        }
    };

    let value = read_settings_file(&path)?;

    // Convert to partial settings
    let partial: PartialIdeSettings =
        serde_json::from_value(value).unwrap_or_default();

    Ok(partial)
}

// =============================================================================
// Settings Writing
// =============================================================================

/// Write settings to a file, preserving format as much as possible
fn write_settings_file(path: &Path, settings: &Value) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    // Pretty print with 2-space indentation
    let content =
        serde_json::to_string_pretty(settings).map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, content).map_err(|e| format!("Failed to write settings file: {}", e))?;

    info!("Wrote settings to {:?}", path);
    Ok(())
}

/// Update a setting at a specific level using dot-notation key
pub fn update_setting(
    level: SettingsLevel,
    key: &str,
    value: Value,
    project_path: Option<&str>,
    scope_default_folder: Option<&str>,
) -> Result<(), String> {
    let path = match level {
        SettingsLevel::User => get_user_settings_path(),
        SettingsLevel::Scope => {
            let folder = scope_default_folder.ok_or("Scope default folder is required for scope settings")?;
            get_scope_settings_path(folder)
        }
        SettingsLevel::Workspace => {
            let path = project_path.ok_or("Project path is required for workspace settings")?;
            get_workspace_settings_path(path)
        }
    };

    // Load existing settings
    let mut settings = read_settings_file(&path)?;

    // Parse the dot-notation key and set the value
    set_nested_value(&mut settings, key, value)?;

    // Write back
    write_settings_file(&path, &settings)
}

/// Delete a setting at a specific level
pub fn delete_setting(
    level: SettingsLevel,
    key: &str,
    project_path: Option<&str>,
    scope_default_folder: Option<&str>,
) -> Result<(), String> {
    let path = match level {
        SettingsLevel::User => get_user_settings_path(),
        SettingsLevel::Scope => {
            let folder = scope_default_folder.ok_or("Scope default folder is required for scope settings")?;
            get_scope_settings_path(folder)
        }
        SettingsLevel::Workspace => {
            let path = project_path.ok_or("Project path is required for workspace settings")?;
            get_workspace_settings_path(path)
        }
    };

    // Load existing settings
    let mut settings = read_settings_file(&path)?;

    // Remove the nested value
    remove_nested_value(&mut settings, key)?;

    // Write back
    write_settings_file(&path, &settings)
}

/// Set a nested value using dot-notation key (e.g., "editor.minimap.enabled")
///
/// Key format: "section.path.to.property" where section is one of: general, editor, git, behavior
/// All dots are treated as path separators, creating nested objects as needed.
fn set_nested_value(root: &mut Value, key: &str, value: Value) -> Result<(), String> {
    let parts: Vec<&str> = key.split('.').collect();
    if parts.len() < 2 {
        return Err(format!("Invalid key format: {} (expected at least section.property)", key));
    }

    // Navigate to the correct location, creating objects as needed
    let mut current = root;
    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            // Last part - set the value
            if let Value::Object(map) = current {
                map.insert(part.to_string(), value);
                return Ok(());
            } else {
                return Err(format!("Cannot set value at {}: parent is not an object", key));
            }
        } else {
            // Navigate or create intermediate object
            if let Value::Object(map) = current {
                current = map
                    .entry(part.to_string())
                    .or_insert_with(|| Value::Object(serde_json::Map::new()));
            } else {
                return Err(format!("Cannot navigate to {}: intermediate value is not an object", key));
            }
        }
    }

    Ok(())
}

/// Remove a nested value using dot-notation key (e.g., "editor.minimap.enabled")
///
/// Key format: "section.path.to.property" - all dots are path separators
fn remove_nested_value(root: &mut Value, key: &str) -> Result<(), String> {
    let parts: Vec<&str> = key.split('.').collect();
    if parts.len() < 2 {
        return Err(format!("Invalid key format: {} (expected at least section.property)", key));
    }

    // Navigate to the parent of the target, then remove the last key
    let mut current = root;
    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            // Last part - remove the value
            if let Value::Object(map) = current {
                map.remove(*part);
                return Ok(());
            } else {
                return Err(format!("Cannot remove value at {}: parent is not an object", key));
            }
        } else {
            // Navigate to the next object
            if let Value::Object(map) = current {
                if let Some(next) = map.get_mut(*part) {
                    current = next;
                } else {
                    // Path doesn't exist, nothing to remove
                    return Ok(());
                }
            } else {
                return Err(format!("Cannot navigate to {}: intermediate value is not an object", key));
            }
        }
    }

    Ok(())
}

// =============================================================================
// Formatter Presets
// =============================================================================

/// Get default formatter presets
pub fn get_formatter_presets() -> Vec<FormatterConfig> {
    vec![
        FormatterConfig {
            id: "eslint".to_string(),
            name: "ESLint".to_string(),
            command: "npx eslint --fix {file}".to_string(),
            languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "javascriptreact".to_string(),
                "typescriptreact".to_string(),
            ],
            enabled: false,
            order: 1,
        },
        FormatterConfig {
            id: "prettier".to_string(),
            name: "Prettier".to_string(),
            command: "npx prettier --write {file}".to_string(),
            languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "javascriptreact".to_string(),
                "typescriptreact".to_string(),
                "json".to_string(),
                "css".to_string(),
                "scss".to_string(),
                "html".to_string(),
                "markdown".to_string(),
                "yaml".to_string(),
            ],
            enabled: false,
            order: 2,
        },
        FormatterConfig {
            id: "oxlint".to_string(),
            name: "Oxlint".to_string(),
            command: "npx oxlint --fix {file}".to_string(),
            languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "javascriptreact".to_string(),
                "typescriptreact".to_string(),
            ],
            enabled: false,
            order: 3,
        },
        FormatterConfig {
            id: "oxfmt".to_string(),
            name: "Oxfmt".to_string(),
            command: "npx oxfmt {file}".to_string(),
            languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "javascriptreact".to_string(),
                "typescriptreact".to_string(),
            ],
            enabled: false,
            order: 4,
        },
        FormatterConfig {
            id: "biome".to_string(),
            name: "Biome".to_string(),
            command: "npx biome format --write {file}".to_string(),
            languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "javascriptreact".to_string(),
                "typescriptreact".to_string(),
                "json".to_string(),
                "css".to_string(),
            ],
            enabled: false,
            order: 5,
        },
        FormatterConfig {
            id: "rustfmt".to_string(),
            name: "rustfmt".to_string(),
            command: "rustfmt {file}".to_string(),
            languages: vec!["rust".to_string()],
            enabled: false,
            order: 6,
        },
        FormatterConfig {
            id: "black".to_string(),
            name: "Black".to_string(),
            command: "black {file}".to_string(),
            languages: vec!["python".to_string()],
            enabled: false,
            order: 7,
        },
        FormatterConfig {
            id: "gofmt".to_string(),
            name: "gofmt".to_string(),
            command: "gofmt -w {file}".to_string(),
            languages: vec!["go".to_string()],
            enabled: false,
            order: 8,
        },
    ]
}

// =============================================================================
// Formatter Execution
// =============================================================================

/// Run a single formatter on a file
pub fn run_formatter(
    formatter: &FormatterConfig,
    file_path: &Path,
    working_dir: &Path,
) -> FormatterResult {
    use std::process::Command;
    use std::time::Instant;

    let start = Instant::now();

    // Replace placeholders in command
    let file_str = file_path.to_string_lossy();
    let dir_str = file_path.parent().map(|p| p.to_string_lossy()).unwrap_or_default();
    let basename = file_path
        .file_name()
        .map(|n| n.to_string_lossy())
        .unwrap_or_default();
    let ext = file_path
        .extension()
        .map(|e| e.to_string_lossy())
        .unwrap_or_default();

    let command = formatter
        .command
        .replace("{file}", &file_str)
        .replace("{dir}", &dir_str)
        .replace("{basename}", &basename)
        .replace("{ext}", &ext);

    info!("Running formatter '{}': {}", formatter.id, command);

    // Parse command into program and args
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return FormatterResult {
            formatter_id: formatter.id.clone(),
            success: false,
            output: None,
            error: Some("Empty command".to_string()),
            duration_ms: start.elapsed().as_millis() as u64,
        };
    }

    let program = parts[0];
    let args = &parts[1..];

    // Run the command
    let result = Command::new(program)
        .args(args)
        .current_dir(working_dir)
        .output();

    let duration_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if output.status.success() {
                info!("Formatter '{}' completed successfully in {}ms", formatter.id, duration_ms);
                FormatterResult {
                    formatter_id: formatter.id.clone(),
                    success: true,
                    output: if stdout.is_empty() { None } else { Some(stdout) },
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                    duration_ms,
                }
            } else {
                let error_msg = if stderr.is_empty() {
                    format!("Formatter exited with code: {:?}", output.status.code())
                } else {
                    stderr
                };
                info!("Formatter '{}' failed: {}", formatter.id, error_msg);
                FormatterResult {
                    formatter_id: formatter.id.clone(),
                    success: false,
                    output: if stdout.is_empty() { None } else { Some(stdout) },
                    error: Some(error_msg),
                    duration_ms,
                }
            }
        }
        Err(e) => {
            let error_msg = format!("Failed to run formatter: {}", e);
            info!("Formatter '{}' error: {}", formatter.id, error_msg);
            FormatterResult {
                formatter_id: formatter.id.clone(),
                success: false,
                output: None,
                error: Some(error_msg),
                duration_ms,
            }
        }
    }
}

/// Get formatters that apply to a given language
pub fn get_formatters_for_language(settings: &IdeSettings, language: &str) -> Vec<FormatterConfig> {
    if !settings.behavior.format_on_save.enabled {
        return Vec::new();
    }

    let mut formatters: Vec<FormatterConfig> = settings
        .behavior
        .format_on_save
        .formatters
        .iter()
        .filter(|f| f.enabled && f.languages.contains(&language.to_string()))
        .cloned()
        .collect();

    // Sort by order
    formatters.sort_by_key(|f| f.order);

    formatters
}

// Use the directories crate for cross-platform home directory
mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        directories::UserDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_jsonc() {
        let jsonc = r#"{
            // This is a comment
            "editor": {
                "fontSize": 14 // inline comment
            }
        }"#;

        let result = parse_jsonc(jsonc).unwrap();
        assert_eq!(result["editor"]["fontSize"], 14);
    }

    #[test]
    fn test_deep_merge() {
        let mut target = serde_json::json!({
            "editor": {
                "fontSize": 13,
                "tabSize": 2
            }
        });

        let source = serde_json::json!({
            "editor": {
                "fontSize": 14
            },
            "git": {
                "blame.enabled": true
            }
        });

        deep_merge(&mut target, &source);

        assert_eq!(target["editor"]["fontSize"], 14);
        assert_eq!(target["editor"]["tabSize"], 2);
        assert_eq!(target["git"]["blame.enabled"], true);
    }

    #[test]
    fn test_set_nested_value() {
        let mut root = serde_json::json!({});

        set_nested_value(&mut root, "editor.fontSize", serde_json::json!(14)).unwrap();

        assert_eq!(root["editor"]["fontSize"], 14);
    }

    #[test]
    fn test_remove_nested_value() {
        let mut root = serde_json::json!({
            "editor": {
                "fontSize": 14,
                "tabSize": 2
            }
        });

        remove_nested_value(&mut root, "editor.fontSize").unwrap();

        assert!(root["editor"].get("fontSize").is_none());
        assert_eq!(root["editor"]["tabSize"], 2);
    }

    #[test]
    fn test_set_nested_value_creates_path() {
        // Test that nested paths are created correctly
        let mut root = serde_json::json!({});

        set_nested_value(&mut root, "general.activityBar.position", serde_json::json!("right")).unwrap();

        // Should create nested structure
        assert_eq!(root["general"]["activityBar"]["position"], "right");
    }

    #[test]
    fn test_remove_deeply_nested_value() {
        let mut root = serde_json::json!({
            "general": {
                "activityBar": {
                    "position": "right"
                },
                "sidebar": {
                    "position": "left"
                }
            }
        });

        remove_nested_value(&mut root, "general.activityBar.position").unwrap();

        assert!(root["general"]["activityBar"].get("position").is_none());
        assert_eq!(root["general"]["sidebar"]["position"], "left");
    }

    #[test]
    fn test_set_nested_object_value() {
        // Test that nested objects like formatOnSave.enabled work correctly
        let mut root = serde_json::json!({
            "behavior": {
                "formatOnSave": {
                    "enabled": false,
                    "formatters": []
                }
            }
        });

        set_nested_value(&mut root, "behavior.formatOnSave.enabled", serde_json::json!(true)).unwrap();

        // Should update the nested enabled property
        assert_eq!(root["behavior"]["formatOnSave"]["enabled"], true);
        // Formatters should be unchanged
        assert!(root["behavior"]["formatOnSave"]["formatters"].is_array());
    }

    #[test]
    fn test_set_nested_object_creates_structure() {
        // Test that creating a new nested object works
        let mut root = serde_json::json!({
            "behavior": {}
        });

        set_nested_value(&mut root, "behavior.formatOnSave.enabled", serde_json::json!(true)).unwrap();

        // Should create the nested structure
        assert_eq!(root["behavior"]["formatOnSave"]["enabled"], true);
    }

    #[test]
    fn test_remove_nested_object_value() {
        let mut root = serde_json::json!({
            "behavior": {
                "formatOnSave": {
                    "enabled": true,
                    "formatters": []
                }
            }
        });

        remove_nested_value(&mut root, "behavior.formatOnSave.enabled").unwrap();

        // enabled should be removed
        assert!(root["behavior"]["formatOnSave"].get("enabled").is_none());
        // formatters should remain
        assert!(root["behavior"]["formatOnSave"]["formatters"].is_array());
    }

    #[test]
    fn test_expand_dotted_keys() {
        // Test that dotted keys like {"minimap.enabled": true} get expanded to nested
        let mut settings = serde_json::json!({
            "editor": {
                "fontSize": 14,
                "minimap.enabled": true,
                "minimap.side": "right",
                "guides.bracketPairs": "active",
                "guides.indentation": true
            }
        });

        normalize_settings(&mut settings);

        // Should be expanded to nested objects
        assert_eq!(settings["editor"]["minimap"]["enabled"], true);
        assert_eq!(settings["editor"]["minimap"]["side"], "right");
        assert_eq!(settings["editor"]["guides"]["bracketPairs"], "active");
        assert_eq!(settings["editor"]["guides"]["indentation"], true);
        assert_eq!(settings["editor"]["fontSize"], 14);
        // Dotted keys should be removed
        assert!(settings["editor"].get("minimap.enabled").is_none());
        assert!(settings["editor"].get("guides.bracketPairs").is_none());
    }

    #[test]
    fn test_normalize_keeps_nested_as_is() {
        // Test that already-nested formats are kept as is
        let mut settings = serde_json::json!({
            "editor": {
                "fontSize": 14,
                "minimap": {
                    "enabled": true,
                    "side": "right"
                }
            }
        });

        normalize_settings(&mut settings);

        // Nested should remain unchanged
        assert_eq!(settings["editor"]["minimap"]["enabled"], true);
        assert_eq!(settings["editor"]["minimap"]["side"], "right");
        assert_eq!(settings["editor"]["fontSize"], 14);
    }

    #[test]
    fn test_normalize_mixed_formats() {
        // Test that both flat and nested formats work together
        let mut settings = serde_json::json!({
            "editor": {
                "fontSize": 14,
                "minimap.enabled": false,  // Dotted key
                "padding": {                 // Already nested
                    "top": 10,
                    "bottom": 5
                }
            }
        });

        normalize_settings(&mut settings);

        // Dotted key should be expanded to nested
        assert_eq!(settings["editor"]["minimap"]["enabled"], false);
        // Already nested should remain unchanged
        assert_eq!(settings["editor"]["padding"]["top"], 10);
        assert_eq!(settings["editor"]["padding"]["bottom"], 5);
    }

    #[test]
    fn test_deeply_nested_settings() {
        // Test three-level nesting
        let mut root = serde_json::json!({});

        set_nested_value(&mut root, "editor.minimap.enabled", serde_json::json!(true)).unwrap();
        set_nested_value(&mut root, "editor.minimap.side", serde_json::json!("left")).unwrap();
        set_nested_value(&mut root, "git.blame.enabled", serde_json::json!(false)).unwrap();

        assert_eq!(root["editor"]["minimap"]["enabled"], true);
        assert_eq!(root["editor"]["minimap"]["side"], "left");
        assert_eq!(root["git"]["blame"]["enabled"], false);
    }
}
