/**
 * Chat Tab Wrapper Component
 *
 * Wrapper that adapts TabComponentProps<ChatTabData> to ChatTabContent props.
 */

import { ChatTabContent } from "./ChatTabContent";
import type { TabComponentProps, ChatTabData } from "../../lib/tabs/types";

export function ChatTabWrapper({ data }: TabComponentProps<ChatTabData>) {
  return (
    <ChatTabContent
      sessionId={data.sessionId}
      sessionName={data.sessionName}
    />
  );
}
