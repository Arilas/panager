/**
 * LSP Dialog
 *
 * Shows all LSP language servers with their status.
 * Allows enabling, disabling, and restarting LSP servers.
 */

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  Server,
  Check,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";
import { usePluginsStore } from "../../stores/plugins";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { PluginInfo, PluginState } from "../../types/plugin";

interface LspDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusIcon(state: PluginState) {
  switch (state) {
    case "active":
      return <Check className="h-3.5 w-3.5 text-green-500" />;
    case "activating":
    case "deactivating":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case "error":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case "inactive":
    default:
      return <X className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
}

function getStatusLabel(state: PluginState): string {
  switch (state) {
    case "active":
      return "Active";
    case "activating":
      return "Starting...";
    case "deactivating":
      return "Stopping...";
    case "error":
      return "Error";
    case "inactive":
    default:
      return "Inactive";
  }
}

function getStatusColor(state: PluginState): string {
  switch (state) {
    case "active":
      return "text-green-500";
    case "activating":
    case "deactivating":
      return "text-blue-500";
    case "error":
      return "text-red-500";
    case "inactive":
    default:
      return "text-muted-foreground/50";
  }
}

export function LspDialog({ open, onOpenChange }: LspDialogProps) {
  const useLiquidGlassEnabled = useLiquidGlass();
  const {
    plugins,
    fetchPlugins,
    enablePlugin,
    disablePlugin,
    restartPlugin,
  } = usePluginsStore();

  const [search, setSearch] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Filter to only show LSP plugins (those with language support)
  const lspPlugins = plugins.filter(
    (p) => p.manifest.languages && p.manifest.languages.length > 0
  );

  // Filter based on search
  const filteredPlugins = search.trim()
    ? lspPlugins.filter(
        (p) =>
          p.manifest.name.toLowerCase().includes(search.toLowerCase()) ||
          p.manifest.languages.some((l) =>
            l.toLowerCase().includes(search.toLowerCase())
          )
      )
    : lspPlugins;

  // Fetch plugins when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      fetchPlugins();
    }
  }, [open, fetchPlugins]);

  const handleRestart = useCallback(
    async (pluginId: string) => {
      setActionInProgress(pluginId);
      try {
        await restartPlugin(pluginId);
      } finally {
        setActionInProgress(null);
      }
    },
    [restartPlugin]
  );

  const handleToggle = useCallback(
    async (plugin: PluginInfo) => {
      setActionInProgress(plugin.manifest.id);
      try {
        if (plugin.state === "active") {
          await disablePlugin(plugin.manifest.id);
        } else {
          await enablePlugin(plugin.manifest.id);
        }
      } finally {
        setActionInProgress(null);
      }
    },
    [enablePlugin, disablePlugin]
  );

  // Count active LSPs
  const activeCount = lspPlugins.filter((p) => p.state === "active").length;
  const totalCount = lspPlugins.length;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Language Servers"
      overlayClassName={
        useLiquidGlassEnabled
          ? "bg-transparent!"
          : "bg-black/40 backdrop-blur-xs"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[520px] -translate-x-1/2",
        "shadow-2xl overflow-hidden",
        useLiquidGlassEnabled
          ? "liquid-glass-command liquid-glass-animate"
          : [
              "rounded-xl",
              "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
            ]
      )}
    >
      <div
        className={cn(
          "flex items-center px-4",
          useLiquidGlassEnabled
            ? "border-b border-white/10"
            : "border-b border-black/5 dark:border-white/5"
        )}
      >
        <Server className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search language servers..."
          className={cn(
            "flex-1 h-12 px-3 text-[14px] bg-transparent",
            "placeholder:text-muted-foreground/50",
            "focus:outline-hidden"
          )}
        />
        <div className="text-xs text-muted-foreground/60">
          {activeCount}/{totalCount} active
        </div>
      </div>

      <Command.List
        className={cn(
          "max-h-[400px] overflow-y-auto",
          useLiquidGlassEnabled ? "p-1" : "p-2"
        )}
      >
        <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/60">
          No language servers found.
        </Command.Empty>

        {filteredPlugins.map((plugin) => (
          <LspPluginItem
            key={plugin.manifest.id}
            plugin={plugin}
            isLoading={actionInProgress === plugin.manifest.id}
            onRestart={() => handleRestart(plugin.manifest.id)}
            onToggle={() => handleToggle(plugin)}
            useLiquidGlass={useLiquidGlassEnabled}
          />
        ))}
      </Command.List>

      <DialogFooter useLiquidGlass={useLiquidGlassEnabled} />
    </Command.Dialog>
  );
}

interface LspPluginItemProps {
  plugin: PluginInfo;
  isLoading: boolean;
  onRestart: () => void;
  onToggle: () => void;
  useLiquidGlass: boolean;
}

function LspPluginItem({
  plugin,
  isLoading,
  onRestart,
  onToggle,
  useLiquidGlass,
}: LspPluginItemProps) {
  const isActive = plugin.state === "active";
  const isTransitioning =
    plugin.state === "activating" || plugin.state === "deactivating";
  const canInteract = !isLoading && !isTransitioning;

  return (
    <Command.Item
      value={`${plugin.manifest.name} ${plugin.manifest.languages.join(" ")}`}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-lg cursor-default",
        "text-[13px] text-foreground/90",
        useLiquidGlass
          ? "aria-selected:bg-white/10"
          : "aria-selected:bg-black/5 dark:aria-selected:bg-white/5",
        "transition-colors"
      )}
    >
      {/* Status indicator */}
      <div className="shrink-0">{getStatusIcon(plugin.state)}</div>

      {/* Plugin info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{plugin.manifest.name}</span>
          <span className={cn("text-[11px]", getStatusColor(plugin.state))}>
            {getStatusLabel(plugin.state)}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/60 truncate">
          {plugin.manifest.languages.join(", ")}
        </div>
        {plugin.error && (
          <div className="text-[11px] text-red-500 truncate mt-0.5">
            {plugin.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            disabled={!canInteract}
            title="Restart"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              useLiquidGlass
                ? "hover:bg-white/20"
                : "hover:bg-black/10 dark:hover:bg-white/10",
              !canInteract && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          disabled={!canInteract}
          title={isActive ? "Disable" : "Enable"}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            useLiquidGlass
              ? "hover:bg-white/20"
              : "hover:bg-black/10 dark:hover:bg-white/10",
            isActive ? "text-green-500" : "text-muted-foreground/50",
            !canInteract && "opacity-50 cursor-not-allowed"
          )}
        >
          {isActive ? (
            <Power className="h-4 w-4" />
          ) : (
            <PowerOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </Command.Item>
  );
}

interface DialogFooterProps {
  useLiquidGlass: boolean;
}

function DialogFooter({ useLiquidGlass }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2",
        useLiquidGlass
          ? "border-t border-white/10"
          : "border-t border-black/5 dark:border-white/5"
      )}
    >
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
            ↑↓
          </kbd>{" "}
          Navigate
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
            esc
          </kbd>{" "}
          Close
        </span>
      </div>
    </div>
  );
}
