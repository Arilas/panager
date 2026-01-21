/**
 * Behavior Settings Tab
 *
 * Save behavior, formatters on save, whitespace handling.
 */

import { useState, useEffect } from "react";
import {
  Save,
  Wrench,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useIdeSettingsStore, useDialogBehaviorSettings } from "../../stores/settings";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import * as api from "../../lib/tauri-ide";
import type { SettingsLevel, FormatterConfig } from "../../types/settings";
import { SUPPORTED_LANGUAGES } from "../../types/settings";
import { SettingSection, ToggleSetting, SelectInput } from "./GeneralSettingsTab";

interface BehaviorSettingsTabProps {
  level: SettingsLevel;
}

export function BehaviorSettingsTab({ level }: BehaviorSettingsTabProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const behaviorSettings = useDialogBehaviorSettings();
  const { updateSetting, loadSettingsForLevel, loadAllLevelSettings } = useIdeSettingsStore();

  const [presets, setPresets] = useState<FormatterConfig[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showCustomFormatterModal, setShowCustomFormatterModal] = useState(false);

  // Load formatter presets
  useEffect(() => {
    api.getFormatterPresets().then(setPresets).catch(console.error);
  }, []);

  const handleUpdate = async (key: string, value: unknown) => {
    await updateSetting(`behavior.${key}`, value, level);
    await loadSettingsForLevel(level);
    await loadAllLevelSettings();
  };

  const handleFormatOnSaveToggle = async (enabled: boolean) => {
    await handleUpdate("formatOnSave.enabled", enabled);
  };

  const handleAddFormatter = async (preset: FormatterConfig) => {
    const currentFormatters = behaviorSettings.formatOnSave.formatters || [];
    // Don't add if already exists
    if (currentFormatters.some((f) => f.id === preset.id)) {
      return;
    }
    const newFormatter: FormatterConfig = {
      ...preset,
      enabled: true,
      order: currentFormatters.length + 1,
    };
    await handleUpdate("formatOnSave.formatters", [...currentFormatters, newFormatter]);
    setShowPresetMenu(false);
  };

  const handleAddCustomFormatter = async (formatter: FormatterConfig) => {
    const currentFormatters = behaviorSettings.formatOnSave.formatters || [];
    const newFormatter: FormatterConfig = {
      ...formatter,
      order: currentFormatters.length + 1,
    };
    await handleUpdate("formatOnSave.formatters", [...currentFormatters, newFormatter]);
    setShowCustomFormatterModal(false);
  };

  const handleRemoveFormatter = async (formatterId: string) => {
    const currentFormatters = behaviorSettings.formatOnSave.formatters || [];
    const newFormatters = currentFormatters
      .filter((f) => f.id !== formatterId)
      .map((f, i) => ({ ...f, order: i + 1 }));
    await handleUpdate("formatOnSave.formatters", newFormatters);
  };

  const handleToggleFormatter = async (formatterId: string, enabled: boolean) => {
    const currentFormatters = behaviorSettings.formatOnSave.formatters || [];
    const newFormatters = currentFormatters.map((f) =>
      f.id === formatterId ? { ...f, enabled } : f
    );
    await handleUpdate("formatOnSave.formatters", newFormatters);
  };

  const handleUpdateFormatter = async (formatterId: string, updates: Partial<FormatterConfig>) => {
    const currentFormatters = behaviorSettings.formatOnSave.formatters || [];
    const newFormatters = currentFormatters.map((f) =>
      f.id === formatterId ? { ...f, ...updates } : f
    );
    await handleUpdate("formatOnSave.formatters", newFormatters);
  };

  const handleMoveFormatter = async (formatterId: string, direction: "up" | "down") => {
    const currentFormatters = [...(behaviorSettings.formatOnSave.formatters || [])];
    const index = currentFormatters.findIndex((f) => f.id === formatterId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentFormatters.length) return;

    // Swap
    [currentFormatters[index], currentFormatters[newIndex]] = [
      currentFormatters[newIndex],
      currentFormatters[index],
    ];

    // Update order
    const newFormatters = currentFormatters.map((f, i) => ({ ...f, order: i + 1 }));
    await handleUpdate("formatOnSave.formatters", newFormatters);
  };

  const formatters = behaviorSettings.formatOnSave.formatters || [];
  const availablePresets = presets.filter(
    (p) => !formatters.some((f) => f.id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Save Behavior */}
      <SettingSection
        title="Save Behavior"
        description="Configure what happens when you save a file."
        icon={<Save className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <ToggleSetting
            label="Trim Trailing Whitespace"
            description="Remove trailing whitespace from all lines when saving."
            checked={behaviorSettings.trimTrailingWhitespace}
            onChange={(v) => handleUpdate("trimTrailingWhitespace", v)}
          />

          <ToggleSetting
            label="Insert Final Newline"
            description="Ensure the file ends with a newline character."
            checked={behaviorSettings.insertFinalNewline}
            onChange={(v) => handleUpdate("insertFinalNewline", v)}
          />
        </div>
      </SettingSection>

      {/* Format on Save */}
      <SettingSection
        title="Format on Save"
        description="Run formatters automatically when saving files."
        icon={<Wrench className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <ToggleSetting
            label="Enable Format on Save"
            description="Run configured formatters when saving a file."
            checked={behaviorSettings.formatOnSave.enabled}
            onChange={handleFormatOnSaveToggle}
          />

          {/* Formatters List */}
          {behaviorSettings.formatOnSave.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-neutral-300" : "text-neutral-600"
                  )}
                >
                  Formatters (run in order)
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowPresetMenu(!showPresetMenu)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-xs",
                      "transition-colors",
                      isDark
                        ? "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                    )}
                  >
                    <Plus className="w-3 h-3" />
                    Add Formatter
                  </button>

                  {showPresetMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowPresetMenu(false)}
                      />
                      <div
                        className={cn(
                          "absolute right-0 top-full mt-1 z-20 w-52",
                          "rounded-lg shadow-lg overflow-hidden",
                          isDark
                            ? "bg-neutral-800 border border-neutral-700"
                            : "bg-white border border-neutral-200"
                        )}
                      >
                        {/* Custom formatter option */}
                        <button
                          onClick={() => {
                            setShowPresetMenu(false);
                            setShowCustomFormatterModal(true);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-sm text-left",
                            "transition-colors border-b",
                            isDark
                              ? "hover:bg-neutral-700 border-neutral-700"
                              : "hover:bg-neutral-100 border-neutral-200"
                          )}
                        >
                          <div className={cn(
                            "flex items-center gap-2",
                            isDark ? "text-neutral-200" : "text-neutral-700"
                          )}>
                            <Plus className="w-3 h-3" />
                            Custom Formatter...
                          </div>
                        </button>

                        {/* Presets */}
                        {availablePresets.length > 0 && (
                          <div className={cn(
                            "text-[10px] px-3 py-1.5 uppercase tracking-wide",
                            isDark ? "text-neutral-500" : "text-neutral-400"
                          )}>
                            Presets
                          </div>
                        )}
                        {availablePresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handleAddFormatter(preset)}
                            className={cn(
                              "w-full px-3 py-2 text-sm text-left",
                              "transition-colors",
                              isDark
                                ? "hover:bg-neutral-700"
                                : "hover:bg-neutral-100"
                            )}
                          >
                            <div className={isDark ? "text-neutral-200" : "text-neutral-700"}>
                              {preset.name}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                isDark ? "text-neutral-500" : "text-neutral-400"
                              )}
                            >
                              {preset.languages.slice(0, 3).join(", ")}
                              {preset.languages.length > 3 && "..."}
                            </div>
                          </button>
                        ))}
                        {availablePresets.length === 0 && (
                          <div className={cn(
                            "px-3 py-2 text-xs",
                            isDark ? "text-neutral-500" : "text-neutral-400"
                          )}>
                            All presets added
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {formatters.length === 0 ? (
                <div
                  className={cn(
                    "text-sm text-center py-6 rounded-lg border border-dashed",
                    isDark
                      ? "border-neutral-700 text-neutral-500"
                      : "border-neutral-300 text-neutral-400"
                  )}
                >
                  No formatters configured. Click "Add Formatter" to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {formatters
                    .sort((a, b) => a.order - b.order)
                    .map((formatter, index) => (
                      <FormatterItem
                        key={formatter.id}
                        formatter={formatter}
                        index={index}
                        total={formatters.length}
                        onToggle={(enabled) =>
                          handleToggleFormatter(formatter.id, enabled)
                        }
                        onUpdate={(updates) =>
                          handleUpdateFormatter(formatter.id, updates)
                        }
                        onRemove={() => handleRemoveFormatter(formatter.id)}
                        onMoveUp={() => handleMoveFormatter(formatter.id, "up")}
                        onMoveDown={() => handleMoveFormatter(formatter.id, "down")}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingSection>

      {/* Auto Save */}
      <SettingSection
        title="Auto Save"
        description="Configure automatic file saving."
        icon={<Save className="w-4 h-4" />}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm",
              isDark ? "text-neutral-300" : "text-neutral-600"
            )}
          >
            Auto Save Delay
          </span>
          <SelectInput
            value={String(behaviorSettings.autoSaveDelay)}
            onChange={(v) => handleUpdate("autoSaveDelay", Number(v))}
            options={[
              { value: "0", label: "Disabled" },
              { value: "1000", label: "1 second" },
              { value: "2000", label: "2 seconds" },
              { value: "5000", label: "5 seconds" },
              { value: "10000", label: "10 seconds" },
            ]}
          />
        </div>
      </SettingSection>

      {/* Custom Formatter Modal */}
      {showCustomFormatterModal && (
        <CustomFormatterModal
          onClose={() => setShowCustomFormatterModal(false)}
          onSave={handleAddCustomFormatter}
          existingIds={formatters.map((f) => f.id)}
        />
      )}
    </div>
  );
}

interface FormatterItemProps {
  formatter: FormatterConfig;
  index: number;
  total: number;
  onToggle: (enabled: boolean) => void;
  onUpdate: (updates: Partial<FormatterConfig>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FormatterItem({
  formatter,
  index,
  total,
  onToggle,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FormatterItemProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingCommand, setEditingCommand] = useState(false);
  const [commandValue, setCommandValue] = useState(formatter.command);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(formatter.name);

  const handleSaveCommand = () => {
    if (commandValue.trim()) {
      onUpdate({ command: commandValue.trim() });
    }
    setEditingCommand(false);
  };

  const handleSaveName = () => {
    if (nameValue.trim()) {
      onUpdate({ name: nameValue.trim() });
    }
    setEditingName(false);
  };

  const handleToggleLanguage = (lang: string) => {
    const newLanguages = formatter.languages.includes(lang)
      ? formatter.languages.filter((l) => l !== lang)
      : [...formatter.languages, lang];
    onUpdate({ languages: newLanguages });
  };

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden min-w-0",
        formatter.enabled
          ? "bg-primary/10 border border-primary/20"
          : isDark
          ? "bg-neutral-800/50 border border-neutral-700"
          : "bg-neutral-100/50 border border-neutral-200"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 p-3 min-w-0">
        {/* Drag handle */}
        <GripVertical
          className={cn(
            "w-4 h-4 shrink-0",
            isDark ? "text-neutral-600" : "text-neutral-400"
          )}
        />

        {/* Toggle */}
        <button
          onClick={() => onToggle(!formatter.enabled)}
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center shrink-0",
            "border-2 transition-colors",
            formatter.enabled
              ? "bg-primary border-primary text-white"
              : isDark
              ? "border-neutral-600"
              : "border-neutral-300"
          )}
        >
          {formatter.enabled && (
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 6l3 3 5-6" />
            </svg>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-sm font-medium",
              isDark ? "text-neutral-200" : "text-neutral-700"
            )}
          >
            {formatter.name}
          </div>
          <div
            className={cn(
              "text-[10px] truncate",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            {formatter.languages.length > 0
              ? formatter.languages.join(", ")
              : "No languages selected"}
          </div>
        </div>

        {/* Edit button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded",
            "transition-colors",
            isExpanded
              ? isDark
                ? "bg-neutral-700 text-neutral-200"
                : "bg-neutral-200 text-neutral-700"
              : isDark
              ? "hover:bg-neutral-700 text-neutral-400"
              : "hover:bg-neutral-200 text-neutral-500"
          )}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded",
              "transition-colors",
              index === 0
                ? "opacity-30 cursor-not-allowed"
                : isDark
                ? "hover:bg-neutral-700"
                : "hover:bg-neutral-200"
            )}
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded",
              "transition-colors",
              index === total - 1
                ? "opacity-30 cursor-not-allowed"
                : isDark
                ? "hover:bg-neutral-700"
                : "hover:bg-neutral-200"
            )}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded",
            "transition-colors",
            isDark
              ? "hover:bg-red-500/20 text-neutral-400 hover:text-red-400"
              : "hover:bg-red-50 text-neutral-400 hover:text-red-500"
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded edit section */}
      {isExpanded && (
        <div
          className={cn(
            "px-3 pb-3 pt-2 border-t space-y-3 overflow-hidden",
            isDark ? "border-neutral-700" : "border-neutral-200"
          )}
        >
          {/* Name */}
          <div>
            <label
              className={cn(
                "block text-[11px] font-medium mb-1",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Name
            </label>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setNameValue(formatter.name);
                      setEditingName(false);
                    }
                  }}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-sm",
                    "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                    isDark
                      ? "bg-neutral-900 border-neutral-600 text-neutral-200"
                      : "bg-white border-neutral-300 text-neutral-700"
                  )}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className={cn(
                    "p-1 rounded",
                    isDark ? "hover:bg-neutral-700" : "hover:bg-neutral-200"
                  )}
                >
                  <Check className="w-4 h-4 text-green-500" />
                </button>
                <button
                  onClick={() => {
                    setNameValue(formatter.name);
                    setEditingName(false);
                  }}
                  className={cn(
                    "p-1 rounded",
                    isDark ? "hover:bg-neutral-700" : "hover:bg-neutral-200"
                  )}
                >
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingName(true)}
                className={cn(
                  "px-2 py-1 rounded text-sm cursor-pointer",
                  "border border-transparent hover:border-dashed",
                  isDark
                    ? "hover:border-neutral-600 text-neutral-300"
                    : "hover:border-neutral-300 text-neutral-600"
                )}
              >
                {formatter.name}
              </div>
            )}
          </div>

          {/* Command */}
          <div>
            <label
              className={cn(
                "block text-[11px] font-medium mb-1",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Command
              <span className={cn("ml-2 font-normal", isDark ? "text-neutral-500" : "text-neutral-400")}>
                (use {"{file}"} for file path)
              </span>
            </label>
            {editingCommand ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commandValue}
                  onChange={(e) => setCommandValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCommand();
                    if (e.key === "Escape") {
                      setCommandValue(formatter.command);
                      setEditingCommand(false);
                    }
                  }}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-sm font-mono",
                    "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                    isDark
                      ? "bg-neutral-900 border-neutral-600 text-neutral-200"
                      : "bg-white border-neutral-300 text-neutral-700"
                  )}
                  autoFocus
                />
                <button
                  onClick={handleSaveCommand}
                  className={cn(
                    "p-1 rounded",
                    isDark ? "hover:bg-neutral-700" : "hover:bg-neutral-200"
                  )}
                >
                  <Check className="w-4 h-4 text-green-500" />
                </button>
                <button
                  onClick={() => {
                    setCommandValue(formatter.command);
                    setEditingCommand(false);
                  }}
                  className={cn(
                    "p-1 rounded",
                    isDark ? "hover:bg-neutral-700" : "hover:bg-neutral-200"
                  )}
                >
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingCommand(true)}
                className={cn(
                  "px-2 py-1 rounded text-sm font-mono cursor-pointer truncate",
                  "border border-transparent hover:border-dashed",
                  isDark
                    ? "hover:border-neutral-600 text-neutral-300"
                    : "hover:border-neutral-300 text-neutral-600"
                )}
              >
                {formatter.command}
              </div>
            )}
          </div>

          {/* Languages */}
          <div className="min-w-0">
            <label
              className={cn(
                "block text-[11px] font-medium mb-2",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Languages
            </label>
            <div className="flex flex-wrap gap-1.5 max-w-full">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = formatter.languages.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => handleToggleLanguage(lang)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] transition-colors shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isDark
                        ? "bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-neutral-300"
                        : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300 hover:text-neutral-600"
                    )}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CustomFormatterModalProps {
  onClose: () => void;
  onSave: (formatter: FormatterConfig) => void;
  existingIds: string[];
}

function CustomFormatterModal({ onClose, onSave, existingIds }: CustomFormatterModalProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!command.trim()) {
      setError("Command is required");
      return;
    }
    if (languages.length === 0) {
      setError("Select at least one language");
      return;
    }

    const id = generateId(name);
    if (existingIds.includes(id)) {
      setError("A formatter with this name already exists");
      return;
    }

    onSave({
      id,
      name: name.trim(),
      command: command.trim(),
      languages,
      enabled: true,
      order: 0, // Will be set by parent
    });
  };

  const handleToggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-[480px] max-h-[80vh] overflow-y-auto rounded-lg shadow-xl",
          isDark ? "bg-neutral-900" : "bg-white"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b",
            isDark ? "border-neutral-700" : "border-neutral-200"
          )}
        >
          <h3
            className={cn(
              "text-sm font-medium",
              isDark ? "text-neutral-200" : "text-neutral-700"
            )}
          >
            Add Custom Formatter
          </h3>
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded",
              isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Error */}
          {error && (
            <div
              className={cn(
                "px-3 py-2 rounded-lg text-sm",
                "bg-red-500/10 text-red-500 border border-red-500/20"
              )}
            >
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label
              className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="My Formatter"
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm",
                "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                isDark
                  ? "bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-600"
                  : "bg-white border-neutral-200 text-neutral-700 placeholder:text-neutral-400"
              )}
            />
          </div>

          {/* Command */}
          <div>
            <label
              className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Command
              <span className={cn("ml-2 font-normal", isDark ? "text-neutral-500" : "text-neutral-400")}>
                (use {"{file}"} for file path)
              </span>
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setError(null);
              }}
              placeholder="npx prettier --write {file}"
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-mono",
                "border focus:outline-none focus:ring-2 focus:ring-primary/30",
                isDark
                  ? "bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-600"
                  : "bg-white border-neutral-200 text-neutral-700 placeholder:text-neutral-400"
              )}
            />
          </div>

          {/* Languages */}
          <div className="min-w-0">
            <label
              className={cn(
                "block text-xs font-medium mb-2",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Languages
            </label>
            <div className="flex flex-wrap gap-1.5 max-w-full">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => handleToggleLanguage(lang)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] transition-colors shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isDark
                        ? "bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-neutral-300"
                        : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300 hover:text-neutral-600"
                    )}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-end gap-2 px-4 py-3 border-t",
            isDark ? "border-neutral-700" : "border-neutral-200"
          )}
        >
          <button
            onClick={onClose}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              "transition-colors",
              isDark
                ? "hover:bg-neutral-800 text-neutral-300"
                : "hover:bg-neutral-100 text-neutral-600"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors"
            )}
          >
            Add Formatter
          </button>
        </div>
      </div>
    </div>
  );
}
