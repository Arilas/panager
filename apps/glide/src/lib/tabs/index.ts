/**
 * Tab System
 *
 * Unified tab management with:
 * - URL-based tab identification
 * - Pluggable resolvers for different tab types
 * - Database-backed persistence
 * - Split view support via tab groups
 */

// Types
export type {
  TabScheme,
  TabComponentProps,
  TabErrorProps,
  TabResolver,
  LazyTabState,
  ResolvedTabState,
  TabSessionData,
  TabEntry,
  TabGroup,
  OpenTabOptions,
  FileTabData,
  DiffTabData,
  ChatTabData,
  MarkdownTabData,
} from "./types";

// URL utilities
export {
  parseTabUrl,
  buildTabUrl,
  buildFileUrl,
  parseFileUrl,
  isFileUrl,
  buildDiffUrl,
  parseDiffUrl,
  isDiffUrl,
  buildChatUrl,
  parseChatUrl,
  isChatUrl,
  isNewChatUrl,
  buildGlideUrl,
  parseGlideUrl,
  isGlideUrl,
  getUrlScheme,
  getFileNameFromUrl,
  getExtensionFromUrl,
} from "./url";
export type { ParsedTabUrl } from "./url";

// Registry
export { TabResolverRegistry, tabResolverRegistry } from "./registry";

// Resolvers
export {
  FileResolver,
  DiffResolver,
  ChatResolver,
  MarkdownResolver,
  registerBuiltinResolvers,
} from "./resolvers";
