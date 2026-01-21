/**
 * Editor Settings Tab
 *
 * Monaco editor configuration: fonts, indentation, display options.
 */

import { Type, AlignLeft, Hash, Map, Eye, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  useIdeSettingsStore,
  useDialogEditorSettings,
} from "../../stores/settings";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import type { SettingsLevel } from "../../types/settings";
import {
  SettingSection,
  ToggleSetting,
  NumberInput,
  SelectInput,
} from "./GeneralSettingsTab";

interface EditorSettingsTabProps {
  level: SettingsLevel;
}

export function EditorSettingsTab({ level }: EditorSettingsTabProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";
  const editorSettings = useDialogEditorSettings();
  const { updateSetting, loadSettingsForLevel, loadAllLevelSettings } =
    useIdeSettingsStore();

  // Update setting - the store's updateSetting already handles reloading
  const handleUpdate = async (key: string, value: unknown) => {
    await updateSetting(`editor.${key}`, value, level);
    await loadSettingsForLevel(level);
    await loadAllLevelSettings();
  };

  return (
    <div className="space-y-6">
      {/* Font Settings */}
      <SettingSection
        title="Font"
        description="Configure the editor font family and size."
        icon={<Type className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-24",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Font Size
            </label>
            <NumberInput
              value={editorSettings.fontSize}
              onChange={(v) => handleUpdate("fontSize", v)}
              min={8}
              max={32}
            />
            <span
              className={cn(
                "text-xs",
                isDark ? "text-neutral-500" : "text-neutral-400",
              )}
            >
              px
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-24",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Line Height
            </label>
            <NumberInput
              value={editorSettings.lineHeight}
              onChange={(v) => handleUpdate("lineHeight", v)}
              min={0}
              max={50}
            />
            <span
              className={cn(
                "text-xs",
                isDark ? "text-neutral-500" : "text-neutral-400",
              )}
            >
              0 = auto
            </span>
          </div>

          <div className="flex items-start gap-3">
            <label
              className={cn(
                "text-sm w-24 pt-2",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Font Family
            </label>
            <input
              type="text"
              value={editorSettings.fontFamily}
              onChange={(e) => handleUpdate("fontFamily", e.target.value)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-sm",
                "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                isDark
                  ? "bg-neutral-800 border-neutral-700 text-neutral-200"
                  : "bg-white border-neutral-200 text-neutral-700",
              )}
            />
          </div>
        </div>
      </SettingSection>

      {/* Indentation */}
      <SettingSection
        title="Indentation"
        description="Configure tab size and indentation style."
        icon={<AlignLeft className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-24",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Tab Size
            </label>
            <NumberInput
              value={editorSettings.tabSize}
              onChange={(v) => handleUpdate("tabSize", v)}
              min={1}
              max={8}
            />
            <span
              className={cn(
                "text-xs",
                isDark ? "text-neutral-500" : "text-neutral-400",
              )}
            >
              spaces
            </span>
          </div>

          <ToggleSetting
            label="Insert Spaces"
            description="Insert spaces when pressing Tab instead of a tab character."
            checked={editorSettings.insertSpaces}
            onChange={(v) => handleUpdate("insertSpaces", v)}
          />
        </div>
      </SettingSection>

      {/* Line Numbers */}
      <SettingSection
        title="Line Numbers"
        description="Configure line number display."
        icon={<Hash className="w-4 h-4" />}
      >
        <SelectInput
          value={editorSettings.lineNumbers}
          onChange={(v) => handleUpdate("lineNumbers", v)}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "relative", label: "Relative" },
            { value: "interval", label: "Interval" },
          ]}
        />
      </SettingSection>

      {/* Word Wrap */}
      <SettingSection
        title="Word Wrap"
        description="Controls how lines are wrapped."
        icon={<AlignLeft className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <SelectInput
            value={editorSettings.wordWrap}
            onChange={(v) => handleUpdate("wordWrap", v)}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
              { value: "wordWrapColumn", label: "At Column" },
              { value: "bounded", label: "Bounded" },
            ]}
          />
          {(editorSettings.wordWrap === "wordWrapColumn" ||
            editorSettings.wordWrap === "bounded") && (
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  "text-sm",
                  isDark ? "text-neutral-300" : "text-neutral-600",
                )}
              >
                Wrap Column
              </label>
              <NumberInput
                value={editorSettings.wordWrapColumn}
                onChange={(v) => handleUpdate("wordWrapColumn", v)}
                min={40}
                max={200}
              />
            </div>
          )}
        </div>
      </SettingSection>

      {/* Minimap */}
      <SettingSection
        title="Minimap"
        description="Configure the code minimap."
        icon={<Map className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Enable Minimap"
            description="Show a small preview of the file on the side."
            checked={editorSettings.minimap.enabled}
            onChange={(v) => handleUpdate("minimap.enabled", v)}
          />
          {editorSettings.minimap.enabled && (
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  "text-sm",
                  isDark ? "text-neutral-300" : "text-neutral-600",
                )}
              >
                Minimap Side
              </label>
              <SelectInput
                value={editorSettings.minimap.side}
                onChange={(v) => handleUpdate("minimap.side", v)}
                options={[
                  { value: "right", label: "Right" },
                  { value: "left", label: "Left" },
                ]}
              />
            </div>
          )}
        </div>
      </SettingSection>

      {/* Display */}
      <SettingSection
        title="Display"
        description="Configure visual display options."
        icon={<Eye className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-36",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Render Whitespace
            </label>
            <SelectInput
              value={editorSettings.renderWhitespace}
              onChange={(v) => handleUpdate("renderWhitespace", v)}
              options={[
                { value: "none", label: "None" },
                { value: "boundary", label: "Boundary" },
                { value: "selection", label: "Selection" },
                { value: "trailing", label: "Trailing" },
                { value: "all", label: "All" },
              ]}
            />
          </div>

          <ToggleSetting
            label="Bracket Pair Colorization"
            description="Colorize matching brackets with different colors."
            checked={editorSettings.bracketPairColorization.enabled}
            onChange={(v) => handleUpdate("bracketPairColorization.enabled", v)}
          />

          <ToggleSetting
            label="Indentation Guides"
            description="Show vertical lines at each indentation level."
            checked={editorSettings.guides.indentation}
            onChange={(v) => handleUpdate("guides.indentation", v)}
          />

          <ToggleSetting
            label="Smooth Scrolling"
            description="Enable smooth scrolling animation."
            checked={editorSettings.smoothScrolling}
            onChange={(v) => handleUpdate("smoothScrolling", v)}
          />

          <ToggleSetting
            label="Scroll Beyond Last Line"
            description="Allow scrolling past the last line of the file."
            checked={editorSettings.scrollBeyondLastLine}
            onChange={(v) => handleUpdate("scrollBeyondLastLine", v)}
          />
        </div>
      </SettingSection>

      {/* Inlay Hints */}
      <SettingSection
        title="Inlay Hints"
        description="Configure inline hints for types and parameter names."
        icon={<Sparkles className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Enable Inlay Hints"
            description="Show inline hints for type information and parameter names."
            checked={editorSettings.inlayHints.enabled}
            onChange={(v) => handleUpdate("inlayHints.enabled", v)}
          />
          {editorSettings.inlayHints.enabled && (
            <>
              <div className="flex items-center gap-3">
                <label
                  className={cn(
                    "text-sm w-36",
                    isDark ? "text-neutral-300" : "text-neutral-600",
                  )}
                >
                  Parameter Names
                </label>
                <SelectInput
                  value={editorSettings.inlayHints.parameterNames}
                  onChange={(v) => handleUpdate("inlayHints.parameterNames", v)}
                  options={[
                    { value: "none", label: "None" },
                    { value: "literals", label: "Literals Only" },
                    { value: "all", label: "All" },
                  ]}
                />
              </div>

              <ToggleSetting
                label="Suppress When Name Matches"
                description="Hide parameter hints when argument name matches parameter name."
                checked={
                  editorSettings.inlayHints
                    .parameterNamesWhenArgumentMatchesName
                }
                onChange={(v) =>
                  handleUpdate(
                    "inlayHints.parameterNamesWhenArgumentMatchesName",
                    v,
                  )
                }
              />

              <ToggleSetting
                label="Parameter Types"
                description="Show type hints for function parameters."
                checked={editorSettings.inlayHints.parameterTypes}
                onChange={(v) => handleUpdate("inlayHints.parameterTypes", v)}
              />

              <ToggleSetting
                label="Variable Types"
                description="Show type hints for variable declarations."
                checked={editorSettings.inlayHints.variableTypes}
                onChange={(v) => handleUpdate("inlayHints.variableTypes", v)}
              />

              <ToggleSetting
                label="Property Declaration Types"
                description="Show type hints for class property declarations."
                checked={editorSettings.inlayHints.propertyDeclarationTypes}
                onChange={(v) =>
                  handleUpdate("inlayHints.propertyDeclarationTypes", v)
                }
              />

              <ToggleSetting
                label="Function Return Types"
                description="Show return type hints for functions."
                checked={editorSettings.inlayHints.functionReturnTypes}
                onChange={(v) =>
                  handleUpdate("inlayHints.functionReturnTypes", v)
                }
              />

              <ToggleSetting
                label="Enum Member Values"
                description="Show values for enum members."
                checked={editorSettings.inlayHints.enumMemberValues}
                onChange={(v) => handleUpdate("inlayHints.enumMemberValues", v)}
              />
            </>
          )}
        </div>
      </SettingSection>

      {/* Cursor */}
      <SettingSection
        title="Cursor"
        description="Configure cursor appearance and behavior."
        icon={<Type className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-28",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Cursor Style
            </label>
            <SelectInput
              value={editorSettings.cursorStyle}
              onChange={(v) => handleUpdate("cursorStyle", v)}
              options={[
                { value: "line", label: "Line" },
                { value: "block", label: "Block" },
                { value: "underline", label: "Underline" },
                { value: "line-thin", label: "Line Thin" },
                { value: "block-outline", label: "Block Outline" },
                { value: "underline-thin", label: "Underline Thin" },
              ]}
            />
          </div>

          <div className="flex items-center gap-3">
            <label
              className={cn(
                "text-sm w-28",
                isDark ? "text-neutral-300" : "text-neutral-600",
              )}
            >
              Cursor Blinking
            </label>
            <SelectInput
              value={editorSettings.cursorBlinking}
              onChange={(v) => handleUpdate("cursorBlinking", v)}
              options={[
                { value: "blink", label: "Blink" },
                { value: "smooth", label: "Smooth" },
                { value: "phase", label: "Phase" },
                { value: "expand", label: "Expand" },
                { value: "solid", label: "Solid" },
              ]}
            />
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
