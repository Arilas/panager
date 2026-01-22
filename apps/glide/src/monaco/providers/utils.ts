/**
 * Utility functions for LSP providers
 */

/**
 * Check if an error is an expected/ignorable LSP error.
 * These include:
 * - "No LSP provider" - when no provider exists for a language
 * - "Method not found" - when an LSP server doesn't support a specific method
 * - "null response" - when a method returns null (no result)
 */
export function isExpectedLspError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes("No LSP provider for language") ||
    errorMessage.includes("Method not found") ||
    errorMessage.includes("-32601") || // JSON-RPC method not found error code
    errorMessage.includes("null response")
  );
}

/**
 * Log an LSP error only if it's not an expected/ignorable error.
 * This prevents cluttering the console with expected errors.
 */
export function logLspErrorIfNeeded(providerName: string, error: unknown): void {
  if (!isExpectedLspError(error)) {
    console.error(`[LSP] ${providerName} error:`, error);
  }
}
