/**
 * Monaco Editor Decorations
 *
 * Exports decoration managers and styles for:
 * - Git blame inline widget
 * - Git gutter decorations
 * - Error Lens inline diagnostics
 */

export { injectEditorStyles, areStylesInjected } from "./styles";
export { GUTTER_ADDED_CLASS, GUTTER_MODIFIED_CLASS, BLAME_DECORATION_CLASS } from "./styles";

export { BlameWidgetManager, blameWidgetManager } from "./blame";
export { GutterDecorationManager, gutterDecorationManager } from "./gutter";
export { ErrorLensManager, errorLensManager } from "./errorLens";
