/**
 * Tab Resolver Registry
 *
 * Manages registration and lookup of tab resolvers.
 * Resolvers are sorted by priority (higher priority first).
 * When finding a resolver for a URL, the first one that canResolve() returns true wins.
 */

import type { TabResolver, ResolvedTabState, LazyTabState } from "./types";

/**
 * Tab Resolver Registry
 *
 * Singleton class that manages all tab resolvers.
 *
 * Usage:
 * ```typescript
 * // Register resolvers at app startup
 * tabResolverRegistry.register(new FileResolver());
 * tabResolverRegistry.register(new DiffResolver());
 * tabResolverRegistry.register(new ChatResolver());
 * tabResolverRegistry.register(new MarkdownResolver()); // Higher priority
 *
 * // Find resolver for a URL
 * const resolver = tabResolverRegistry.findResolver(url);
 * if (resolver) {
 *   const state = await resolver.resolve(url);
 * }
 * ```
 */
export class TabResolverRegistry {
  /** Map of resolver ID to resolver instance */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolvers: Map<string, TabResolver<any>> = new Map();

  /** Cached sorted list of resolvers (by priority, descending) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sortedResolvers: TabResolver<any>[] | null = null;

  /**
   * Register a resolver
   *
   * @param resolver The resolver to register
   * @throws Error if a resolver with the same ID is already registered
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(resolver: TabResolver<any>): void {
    if (this.resolvers.has(resolver.id)) {
      throw new Error(
        `Resolver with ID "${resolver.id}" is already registered`
      );
    }
    this.resolvers.set(resolver.id, resolver);
    this.sortedResolvers = null; // Invalidate cache
  }

  /**
   * Unregister a resolver by ID
   *
   * @param id The resolver ID to unregister
   */
  unregister(id: string): void {
    this.resolvers.delete(id);
    this.sortedResolvers = null; // Invalidate cache
  }

  /**
   * Get a resolver by ID
   *
   * @param id The resolver ID
   * @returns The resolver or undefined if not found
   */
  getResolver(id: string): TabResolver | undefined {
    return this.resolvers.get(id);
  }

  /**
   * Find the best resolver for a URL
   *
   * Iterates through resolvers sorted by priority (highest first)
   * and returns the first one where canResolve() returns true.
   *
   * @param url The URL to find a resolver for
   * @returns The resolver or null if none can handle the URL
   */
  findResolver(url: string): TabResolver | null {
    const sorted = this.getSortedResolvers();

    for (const resolver of sorted) {
      if (resolver.canResolve(url)) {
        return resolver;
      }
    }

    return null;
  }

  /**
   * Resolve a URL using the best matching resolver
   *
   * @param url The URL to resolve
   * @returns The resolved tab state
   * @throws Error if no resolver can handle the URL or resolution fails
   */
  async resolve(url: string): Promise<ResolvedTabState> {
    const resolver = this.findResolver(url);
    if (!resolver) {
      throw new Error(`No resolver found for URL: ${url}`);
    }
    return resolver.resolve(url);
  }

  /**
   * Create a lazy tab state for a URL
   *
   * @param url The URL to create lazy state for
   * @returns Lazy tab state with display name from resolver
   * @throws Error if no resolver can handle the URL
   */
  createLazyState(url: string): LazyTabState {
    const resolver = this.findResolver(url);
    if (!resolver) {
      throw new Error(`No resolver found for URL: ${url}`);
    }
    return {
      url,
      type: resolver.id,
      displayName: resolver.getDisplayName(url),
    };
  }

  /**
   * Get all registered resolvers sorted by priority (highest first)
   */
  getSortedResolvers(): TabResolver[] {
    if (this.sortedResolvers === null) {
      this.sortedResolvers = Array.from(this.resolvers.values()).sort(
        (a, b) => b.priority - a.priority
      );
    }
    return this.sortedResolvers;
  }

  /**
   * Get all registered resolver IDs
   */
  getResolverIds(): string[] {
    return Array.from(this.resolvers.keys());
  }

  /**
   * Check if a resolver is registered
   */
  hasResolver(id: string): boolean {
    return this.resolvers.has(id);
  }

  /**
   * Clear all registered resolvers
   * Mainly useful for testing
   */
  clear(): void {
    this.resolvers.clear();
    this.sortedResolvers = null;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * Global tab resolver registry instance
 *
 * This is the main entry point for resolver registration and lookup.
 * Register resolvers at app startup before any tabs are opened.
 */
export const tabResolverRegistry = new TabResolverRegistry();
