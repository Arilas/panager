/**
 * Chat Message - Renders a single chat message
 *
 * Handles both user and assistant messages, including tool calls and streaming.
 */

import { User, Bot, FileText, Terminal, Diff } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { ChatMessage as ChatMessageType, ToolCall } from "../../types/acp";
import { isTextBlock, isResourceBlock, isDiffContent, isTerminalContent } from "../../types/acp";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function ChatMessage({ message, isStreaming, streamingContent }: ChatMessageProps) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  const isUser = message.role === "user";
  const Icon = isUser ? User : Bot;

  // Get text content from message
  const textContent = message.content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join("\n");

  // Combine with streaming content if applicable
  const displayText = isStreaming && streamingContent ? textContent + streamingContent : textContent;

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
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

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-2",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Main text content */}
        {displayText && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              "whitespace-pre-wrap break-words",
              isUser
                ? isDark
                  ? "bg-blue-500/20 text-white"
                  : "bg-blue-500/10 text-neutral-900"
                : isDark
                  ? "bg-white/5 text-white"
                  : "bg-black/5 text-neutral-900"
            )}
          >
            {displayText}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
            )}
          </div>
        )}

        {/* Resource attachments (for user messages) */}
        {message.content.filter(isResourceBlock).map((block, index) => (
          <div
            key={index}
            className={cn(
              "inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs",
              isDark ? "bg-white/10 text-white" : "bg-black/5 text-neutral-700"
            )}
          >
            <FileText className="w-3 h-3" />
            {block.resource.name || block.resource.uri}
          </div>
        ))}

        {/* Tool calls (for assistant messages) */}
        {message.toolCalls?.map((toolCall) => (
          <ToolCallCard key={toolCall.toolCallId} toolCall={toolCall} />
        ))}

        {/* Thoughts (for assistant messages) */}
        {message.thoughts && message.thoughts.length > 0 && (
          <details className="text-xs">
            <summary
              className={cn(
                "cursor-pointer",
                isDark ? "text-neutral-400" : "text-neutral-500"
              )}
            >
              Thoughts ({message.thoughts.length})
            </summary>
            <div
              className={cn(
                "mt-1 p-2 rounded-md space-y-1",
                isDark ? "bg-white/5" : "bg-black/5"
              )}
            >
              {message.thoughts.map((thought, index) => (
                <p key={index} className={isDark ? "text-neutral-300" : "text-neutral-600"}>
                  {thought}
                </p>
              ))}
            </div>
          </details>
        )}

        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

/**
 * Tool Call Card - Renders a tool call within a message
 */
function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const { effectiveTheme } = useIdeSettingsContext();
  const isDark = effectiveTheme === "dark";

  // Determine icon based on kind
  const Icon =
    toolCall.kind === "edit"
      ? Diff
      : toolCall.kind === "execute"
        ? Terminal
        : FileText;

  // Status colors
  const statusColors = {
    pending: "text-neutral-400",
    in_progress: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-sm",
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          "border-b",
          isDark ? "border-white/10" : "border-black/10"
        )}
      >
        <Icon className={cn("w-4 h-4", statusColors[toolCall.status])} />
        <span className={cn("font-medium", isDark ? "text-white" : "text-neutral-900")}>
          {toolCall.title}
        </span>
        <span
          className={cn(
            "ml-auto text-xs px-1.5 py-0.5 rounded",
            isDark ? "bg-white/10" : "bg-black/5",
            statusColors[toolCall.status]
          )}
        >
          {toolCall.status}
        </span>
      </div>

      {/* Content */}
      {toolCall.content && (
        <div className="p-3">
          {toolCall.content.type === "text" && (
            <pre
              className={cn(
                "text-xs whitespace-pre-wrap",
                isDark ? "text-neutral-300" : "text-neutral-600"
              )}
            >
              {toolCall.content.text}
            </pre>
          )}

          {isDiffContent(toolCall.content) && (
            <div className="text-xs">
              <div className={cn("mb-1", isDark ? "text-neutral-400" : "text-neutral-500")}>
                {toolCall.content.diff.path}
              </div>
              {/* Simplified diff display - full implementation would use a diff viewer */}
              <pre
                className={cn(
                  "whitespace-pre-wrap font-mono",
                  isDark ? "text-neutral-300" : "text-neutral-600"
                )}
              >
                {toolCall.content.diff.hunks
                  ?.flatMap((h) => h.lines)
                  .map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.type === "add" && "text-green-500 bg-green-500/10",
                        line.type === "delete" && "text-red-500 bg-red-500/10"
                      )}
                    >
                      {line.type === "add" ? "+ " : line.type === "delete" ? "- " : "  "}
                      {line.content}
                    </div>
                  )) || "No diff content"}
              </pre>
            </div>
          )}

          {isTerminalContent(toolCall.content) && (
            <div className="text-xs font-mono">
              <pre
                className={cn(
                  "whitespace-pre-wrap",
                  isDark ? "text-neutral-300" : "text-neutral-600"
                )}
              >
                {toolCall.content.terminal.output || "(No output)"}
              </pre>
              {toolCall.content.terminal.exitCode !== undefined && (
                <div
                  className={cn(
                    "mt-1",
                    toolCall.content.terminal.exitCode === 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  Exit code: {toolCall.content.terminal.exitCode}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Locations */}
      {toolCall.locations && toolCall.locations.length > 0 && (
        <div className={cn("px-3 py-2 border-t", isDark ? "border-white/10" : "border-black/10")}>
          <div className="flex flex-wrap gap-1">
            {toolCall.locations.map((loc, index) => (
              <span
                key={index}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  isDark ? "bg-white/10 text-neutral-300" : "bg-black/5 text-neutral-600"
                )}
              >
                {loc.uri}
                {loc.range && `:${loc.range.start.line}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
