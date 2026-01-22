/**
 * Chat Resolver
 *
 * Handles chat:// URLs for AI chat sessions.
 * Special case: chat://new creates a new session and returns a different URL.
 */

import type { ComponentType, ReactElement } from "react";
import { Sparkles } from "lucide-react";
import type {
  TabResolver,
  ResolvedTabState,
  ChatTabData,
  TabComponentProps,
  TabErrorProps,
} from "../types";
import { parseChatUrl, isChatUrl, isNewChatUrl, buildChatUrl } from "../url";
import { ChatTabWrapper } from "../../../components/agent/ChatTabWrapper";
import { FileTabError } from "../../../components/editor/FileTabError";

/**
 * Chat Resolver
 *
 * Handles loading and displaying AI chat sessions.
 *
 * URL formats:
 * - chat://new - Creates a new session (URL changes on resolve)
 * - chat://session-id - Opens existing session
 */
export class ChatResolver implements TabResolver<ChatTabData> {
  readonly id = "chat";
  readonly priority = 0;
  readonly schemes = ["chat"] as const;

  constructor(_projectPath: string) {
    // Project path not used for chat sessions, but kept for consistency with other resolvers
  }

  canResolve(url: string): boolean {
    return isChatUrl(url);
  }

  getDisplayName(url: string): string {
    if (isNewChatUrl(url)) {
      return "New Chat";
    }
    // For existing sessions, we'll update the display name after loading
    return "Chat";
  }

  toFilePath(): string | null {
    // Chat tabs don't have associated file paths
    return null;
  }

  getComponent(): ComponentType<TabComponentProps<ChatTabData>> {
    return ChatTabWrapper;
  }

  getErrorComponent(): ComponentType<TabErrorProps> {
    return FileTabError;
  }

  getIcon(_url: string, className?: string): ReactElement {
    return <Sparkles className={className} />;
  }

  async resolve(url: string): Promise<ResolvedTabState<ChatTabData>> {
    const sessionId = parseChatUrl(url);

    if (sessionId === "new") {
      // Create a new session via the ACP system
      // The actual session creation is handled by the agent store
      // We return a placeholder that will be updated when the session is created
      // TODO: Implement this here
      const newSessionId = `pending-${Date.now()}`;

      return {
        url: buildChatUrl(newSessionId),
        type: this.id,
        displayName: "New Chat",
        data: {
          sessionId: newSessionId,
          sessionName: "New Chat",
        },
      };
    }

    // Load existing session
    // The session data is managed by the agent store, not fetched here
    // We just provide the session ID and the component will handle loading
    // TODO: Implement this here
    return {
      url,
      type: this.id,
      displayName: "Chat", // Will be updated by component once session is loaded
      data: {
        sessionId,
        sessionName: "Chat",
      },
    };
  }

  async onExternalChange(): Promise<ResolvedTabState<ChatTabData> | null> {
    // Chat sessions don't have external changes like files
    // Session updates are handled through the agent store events
    return null;
  }
}
