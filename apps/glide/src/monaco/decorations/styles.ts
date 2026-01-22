/**
 * CSS styles for Monaco editor decorations and widgets
 *
 * Injects styles for:
 * - Git blame inline decorations
 * - Git gutter decorations (added/modified lines)
 * - Hover widgets (liquid glass styling)
 *
 * Note: Context menus are handled by our custom React component
 * (MonacoContextMenu) instead of Monaco's built-in menus.
 */

let stylesInjected = false;

// CSS class names
export const GUTTER_ADDED_CLASS = "git-gutter-added";
export const GUTTER_MODIFIED_CLASS = "git-gutter-modified";
export const BLAME_DECORATION_CLASS = "git-blame-decoration";

/**
 * Inject CSS styles for all Monaco decorations.
 * Should be called once during Monaco initialization.
 */
export function injectEditorStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.id = "monaco-editor-decorations-styles";
  style.textContent = `
    /* Git blame inline decoration */
    .${BLAME_DECORATION_CLASS} {
      color: rgba(139, 148, 158, 0.6) !important;
      font-style: italic !important;
    }

    /* Git gutter - added line indicator (green bar) */
    .${GUTTER_ADDED_CLASS} {
      background-color: rgba(40, 167, 69, 0.8);
      width: 3px !important;
      margin-left: 3px;
    }

    /* Git gutter - modified line indicator (blue bar) */
    .${GUTTER_MODIFIED_CLASS} {
      background-color: rgba(0, 122, 204, 0.8);
      width: 3px !important;
      margin-left: 3px;
    }

    /* Blame widget styling */
    .git-blame-widget {
      font-style: italic;
      font-size: 0.9em;
      white-space: nowrap;
      pointer-events: none;
      margin-left: 3em;
    }

    .git-blame-widget--uncommitted {
      color: rgba(100, 180, 100, 0.7);
    }

    .git-blame-widget--committed {
      color: rgba(139, 148, 158, 0.7);
    }

    /* ========================================
       Native Liquid Glass Support (macOS 26+)
       For hover widgets only - context menus
       are handled by our custom React component
       ======================================== */

    @supports (-apple-visual-effect: -apple-system-glass-material) {
      /* Hover widget styling with native liquid glass */
      html:not(.no-glass) .monaco-editor .monaco-hover {
        background: transparent !important;
        -apple-visual-effect: -apple-system-glass-material;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 8px !important;
      }
    }
  `;
  document.head.appendChild(style);

  console.log("[Monaco] Injected editor decoration styles");
}

/**
 * Check if styles have been injected.
 */
export function areStylesInjected(): boolean {
  return stylesInjected;
}
