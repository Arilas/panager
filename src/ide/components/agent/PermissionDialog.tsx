/**
 * Permission Dialog - UI for approving/denying tool execution requests
 *
 * Displays when the ACP agent needs user permission to execute a tool.
 */

import { Shield, Check, X, AlertTriangle } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { PermissionRequest } from "../../types/acp";

interface PermissionDialogProps {
  request: PermissionRequest;
  onRespond: (optionId: string) => void;
}

export function PermissionDialog({ request, onRespond }: PermissionDialogProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 mb-4",
        isDark
          ? "bg-amber-950/30 border-amber-700/50"
          : "bg-amber-50 border-amber-200"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            "p-2 rounded-lg shrink-0",
            isDark ? "bg-amber-900/50" : "bg-amber-100"
          )}
        >
          <Shield
            className={cn(
              "w-5 h-5",
              isDark ? "text-amber-400" : "text-amber-600"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-medium text-sm",
              isDark ? "text-amber-200" : "text-amber-900"
            )}
          >
            Permission Required
          </h3>
          <p
            className={cn(
              "text-sm mt-1",
              isDark ? "text-amber-300/80" : "text-amber-800"
            )}
          >
            {request.toolName}
          </p>
        </div>
      </div>

      {/* Description */}
      {request.description && (
        <div
          className={cn(
            "text-sm mb-4 p-3 rounded font-mono text-xs overflow-x-auto",
            isDark ? "bg-black/20 text-neutral-300" : "bg-white/50 text-neutral-700"
          )}
        >
          {request.description}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {request.options.map((option) => {
          const isDeny =
            option.label.toLowerCase().includes("deny") ||
            option.id.toLowerCase().includes("deny");
          const isDefault = option.isDefault;

          return (
            <button
              key={option.id}
              onClick={() => onRespond(option.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                isDeny
                  ? isDark
                    ? "bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-700/50"
                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                  : isDefault
                  ? isDark
                    ? "bg-green-900/50 text-green-300 hover:bg-green-900/70 border border-green-700/50"
                    : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                  : isDark
                  ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
                  : "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200"
              )}
              title={option.description}
            >
              {isDeny ? (
                <X className="w-4 h-4" />
              ) : isDefault ? (
                <Check className="w-4 h-4" />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Warning note */}
      <div
        className={cn(
          "flex items-center gap-2 mt-3 text-xs",
          isDark ? "text-amber-400/70" : "text-amber-700/70"
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Review the action before approving</span>
      </div>
    </div>
  );
}
