/**
 * Tauri ACP (Agent Client Protocol) API wrapper
 *
 * Provides typed wrappers for all ACP-related Tauri commands.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMode,
  ContentBlock,
  SessionStatus,
} from "../types/acp";

/**
 * Connect to ACP agent for a project
 */
export async function acpConnect(projectPath: string): Promise<void> {
  return invoke("acp_connect", { projectPath });
}

/**
 * Disconnect from ACP agent
 */
export async function acpDisconnect(projectPath: string): Promise<void> {
  return invoke("acp_disconnect", { projectPath });
}

/**
 * Get ACP connection status
 */
export async function acpGetStatus(projectPath: string): Promise<SessionStatus> {
  return invoke("acp_get_status", { projectPath });
}

/**
 * Create a new ACP session
 */
export async function acpNewSession(
  projectPath: string,
  mode?: AgentMode
): Promise<string> {
  return invoke("acp_new_session", { projectPath, mode });
}

/**
 * Send a prompt to the ACP session
 */
export async function acpSendPrompt(
  projectPath: string,
  sessionId: string,
  content: ContentBlock[]
): Promise<void> {
  return invoke("acp_send_prompt", { projectPath, sessionId, content });
}

/**
 * Cancel the current prompt
 */
export async function acpCancel(
  projectPath: string,
  sessionId: string
): Promise<void> {
  return invoke("acp_cancel", { projectPath, sessionId });
}

/**
 * Set the session mode
 */
export async function acpSetMode(
  projectPath: string,
  sessionId: string,
  mode: AgentMode
): Promise<void> {
  return invoke("acp_set_mode", { projectPath, sessionId, mode });
}

/**
 * Respond to a permission request
 */
export async function acpRespondPermission(
  projectPath: string,
  requestId: string,
  selectedOption: string
): Promise<void> {
  return invoke("acp_respond_permission", { projectPath, requestId, selectedOption });
}

/**
 * Get current session ID
 */
export async function acpGetCurrentSession(
  projectPath: string
): Promise<string | null> {
  return invoke("acp_get_current_session", { projectPath });
}
