/**
 * Monaco Editor Module
 *
 * Centralized Monaco configuration and initialization.
 * Import initializeMonaco from here and call it at app startup.
 */

// Main initialization
export {
  initializeMonaco,
  getMonaco,
  isMonacoReady,
  getInitStatus,
} from "./loader";

// Theme utilities
export { getMonacoTheme, isShikiInitialized } from "./themes";

// Decoration managers
export {
  blameWidgetManager,
  gutterDecorationManager,
  BlameWidgetManager,
  GutterDecorationManager,
} from "./decorations";

// Provider utilities
export { triggerCodeLensRefresh } from "./providers/codeLens";
export { LSP_LANGUAGES } from "./providers";
