/**
 * Tab Resolvers
 *
 * Export all built-in resolvers for registration.
 */

export { FileResolver } from "./FileResolver";
export { DiffResolver } from "./DiffResolver";
export { ChatResolver } from "./ChatResolver";
export { MarkdownResolver } from "./MarkdownResolver";

import { tabResolverRegistry } from "../registry";
import { FileResolver } from "./FileResolver";
import { DiffResolver } from "./DiffResolver";
import { ChatResolver } from "./ChatResolver";
import { MarkdownResolver } from "./MarkdownResolver";

/**
 * Register all built-in resolvers with the global registry.
 *
 * Call this at app startup after project path is known.
 *
 * @param projectPath - The current project path (used by resolvers)
 */
export function registerBuiltinResolvers(projectPath: string): void {
  // Clear any existing resolvers (in case of re-registration)
  tabResolverRegistry.clear();

  // Register resolvers in priority order (highest priority first)
  // MarkdownResolver (priority 10) - intercepts .md files before FileResolver
  tabResolverRegistry.register(new MarkdownResolver(projectPath));

  // Standard resolvers (priority 0)
  tabResolverRegistry.register(new FileResolver(projectPath));
  tabResolverRegistry.register(new DiffResolver(projectPath));
  tabResolverRegistry.register(new ChatResolver(projectPath));
}
