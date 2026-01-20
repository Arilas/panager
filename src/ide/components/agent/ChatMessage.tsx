/**
 * Chat Message - Renders a message entry
 *
 * Handles both user and assistant messages.
 * Tool calls are rendered separately as ToolCallCard.
 */

import { User, Bot } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { MessageEntry } from "../../types/acp";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageProps {
  entry: MessageEntry;
  /** Whether this is rendered in a tab (vs sidebar) - hides assistant avatar in sidebar */
  isTab?: boolean;
}

export function ChatMessage({ entry, isTab = false }: ChatMessageProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const isUser = entry.role === "user";
  const Icon = isUser ? User : Bot;

  // Hide assistant avatar in sidebar mode to save space
  const showAvatar = isUser || isTab;

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar - hidden for assistant in sidebar mode */}
      {showAvatar && (
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
            isUser
              ? isDark
                ? "bg-blue-500/20 text-blue-400"
                : "bg-blue-500/10 text-blue-600"
              : isDark
                ? "bg-purple-500/20 text-purple-400"
                : "bg-purple-500/10 text-purple-600"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-2",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Main text content */}
        {entry.content && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              isUser
                ? isDark
                  ? "bg-blue-500/20 text-white"
                  : "bg-blue-500/10 text-neutral-900"
                : isDark
                  ? "bg-white/5 text-white"
                  : "bg-black/5 text-neutral-900"
            )}
          >
            {isUser ? (
              // User messages: plain text (no markdown)
              <div className="whitespace-pre-wrap break-words">{entry.content}</div>
            ) : (
              // Assistant messages: render markdown
              <MarkdownContent content={entry.content} />
            )}
          </div>
        )}

        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        >
          {new Date(entry.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
