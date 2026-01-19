/**
 * Settings Panel - Plugin management and IDE settings
 *
 * Displays list of plugins with enable/disable toggles.
 * Shows plugin status, description, and supported languages.
 */

import { useEffect } from "react";
import {
  Puzzle,
  Power,
  PowerOff,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
} from "lucide-react";
import { usePluginsStore } from "../../stores/plugins";
import { useIdeStore } from "../../stores/ide";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { PluginInfo, PluginState } from "../../types/plugin";

export function SettingsPanel() {
  const { plugins, loading, error, fetchPlugins } = usePluginsStore();
  const setShowSettingsDialog = useIdeStore((s) => s.setShowSettingsDialog);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  // Fetch plugins on mount
  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  return (
    <div className="h-full flex flex-col">
      {/* IDE Settings Button */}
      <div
        className={cn(
          "px-3 py-3 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <button
          onClick={() => setShowSettingsDialog(true)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
            "transition-colors text-sm font-medium",
            isDark
              ? "bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
              : "bg-neutral-100/50 hover:bg-neutral-200/50 text-neutral-700",
            "border border-black/5 dark:border-white/5"
          )}
        >
          <Settings className="w-4 h-4" />
          <span>IDE Settings</span>
        </button>
      </div>

      {/* Plugins Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-2">
          <Puzzle
            className={cn(
              "w-4 h-4",
              isDark ? "text-neutral-400" : "text-neutral-500"
            )}
          />
          <h2
            className={cn(
              "text-sm font-semibold",
              isDark ? "text-neutral-200" : "text-neutral-700"
            )}
          >
            Plugins
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div
            className={cn(
              "flex items-center justify-center py-8",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : error ? (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm",
              "text-red-500"
            )}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : plugins.length === 0 ? (
          <div
            className={cn(
              "text-sm text-center py-8",
              isDark ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            No plugins available
          </div>
        ) : (
          <div className="space-y-1">
            {plugins.map((plugin) => (
              <PluginItem key={plugin.manifest.id} plugin={plugin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PluginItemProps {
  plugin: PluginInfo;
}

function PluginItem({ plugin }: PluginItemProps) {
  const { enablePlugin, disablePlugin } = usePluginsStore();
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const { manifest, state, error } = plugin;

  const isActive = state === "active";
  const isLoading = state === "activating" || state === "deactivating";
  const hasError = state === "error";

  const handleToggle = async () => {
    if (isLoading) return;

    if (isActive) {
      await disablePlugin(manifest.id);
    } else {
      await enablePlugin(manifest.id);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg p-3",
        isDark ? "bg-neutral-800/50" : "bg-neutral-100/50",
        "border border-black/5 dark:border-white/5"
      )}
    >
      {/* Header with name and toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PluginStatusIcon state={state} />
          <span
            className={cn(
              "text-sm font-medium truncate",
              isDark ? "text-neutral-200" : "text-neutral-700"
            )}
          >
            {manifest.name}
          </span>
          {manifest.isBuiltin && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                isDark
                  ? "bg-neutral-700 text-neutral-400"
                  : "bg-neutral-200 text-neutral-500"
              )}
            >
              Built-in
            </span>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg",
            "transition-colors",
            isLoading && "cursor-not-allowed opacity-50",
            isActive
              ? isDark
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-green-500/20 text-green-600 hover:bg-green-500/30"
              : isDark
                ? "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
          )}
          title={isActive ? "Disable plugin" : "Enable plugin"}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isActive ? (
            <Power className="w-4 h-4" />
          ) : (
            <PowerOff className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Version */}
      <p
        className={cn(
          "text-[10px] mt-1",
          isDark ? "text-neutral-500" : "text-neutral-400"
        )}
      >
        v{manifest.version}
      </p>

      {/* Description */}
      <p
        className={cn(
          "text-xs mt-2",
          isDark ? "text-neutral-400" : "text-neutral-500"
        )}
      >
        {manifest.description}
      </p>

      {/* Supported languages */}
      {manifest.languages.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {manifest.languages.map((lang) => (
            <span
              key={lang}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                isDark
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-blue-500/10 text-blue-600"
              )}
            >
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* Error message */}
      {hasError && error && (
        <div
          className={cn(
            "flex items-start gap-1.5 mt-2 text-xs",
            "text-red-500"
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function PluginStatusIcon({ state }: { state: PluginState }) {
  switch (state) {
    case "active":
      return <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case "activating":
    case "deactivating":
      return (
        <Loader2 className="w-3.5 h-3.5 text-blue-500 shrink-0 animate-spin" />
      );
    case "error":
      return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    case "inactive":
    default:
      return (
        <div className="w-3.5 h-3.5 rounded-full border border-neutral-400 shrink-0" />
      );
  }
}
