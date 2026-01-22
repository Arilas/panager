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
 * Resume an existing session from the database
 * Creates a new ACP session and maps it to the existing DB session ID
 */
export async function acpResumeSession(
  projectPath: string,
  sessionId: string,
  mode?: AgentMode
): Promise<string> {
  return invoke("acp_resume_session", { projectPath, sessionId, mode });
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

// ============================================================
// Database Types (matching Rust DbSession, DbEntry, etc.)
// ============================================================

/** Session info for listing (without entries) */
export interface DbSessionInfo {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  entryCount: number;
}

/** Chat session stored in database */
export interface DbSession {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
}

/** Entry stored in database (unified for all entry types) */
export interface DbEntry {
  id: number;
  sessionId: string;
  entryType: string;
  createdAt: number;
  updatedAt?: number;

  // Message fields
  role?: string;
  content?: string;

  // Tool call fields
  toolCallId?: string;
  toolName?: string;
  toolStatus?: string;
  toolInput?: string;
  toolOutput?: string;
  toolTitle?: string;
  toolKind?: string;

  // Permission request fields
  requestId?: string;
  requestToolName?: string;
  requestDescription?: string;
  requestOptions?: string;
  responseOption?: string;
  responseTime?: number;

  // Meta fields
  availableModes?: string;
  availableModels?: string;
  currentModeId?: string;
  currentModelId?: string;
}

/** Chat session with entries (for loading full session) */
export interface DbSessionWithEntries {
  session: DbSession;
  entries: DbEntry[];
}

// ============================================================
// Database API Functions
// ============================================================

/**
 * List all chat sessions for a project
 */
export async function acpListSessions(
  projectPath: string
): Promise<DbSessionInfo[]> {
  return invoke("acp_list_sessions", { projectPath });
}

/**
 * Load a chat session with all its entries
 */
export async function acpLoadSession(
  projectPath: string,
  sessionId: string
): Promise<DbSessionWithEntries | null> {
  return invoke("acp_load_session", { projectPath, sessionId });
}

/**
 * Delete a chat session
 */
export async function acpDeleteSession(
  projectPath: string,
  sessionId: string
): Promise<void> {
  return invoke("acp_delete_session", { projectPath, sessionId });
}

/**
 * Update session name
 */
export async function acpUpdateSessionName(
  projectPath: string,
  sessionId: string,
  name: string
): Promise<void> {
  return invoke("acp_update_session_name", { projectPath, sessionId, name });
}
