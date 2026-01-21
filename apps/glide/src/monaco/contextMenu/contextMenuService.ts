/**
 * Custom Context Menu Service for Monaco Editor
 *
 * Replaces Monaco's built-in context menu with our custom React component.
 * This service intercepts context menu requests and converts Monaco's
 * IContextMenuDelegate to our own format.
 */

import { IDisposable } from "monaco-editor/esm/vs/editor/editor.api.js";
import type { ContextMenuAction, ContextMenuState } from "./MonacoContextMenu";
export type OmitOptional<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

type ContextMenuLocation = OmitOptional<IAnchor> & { getModifierState?: never };

export interface IBaseActionViewItemOptions {
  readonly draggable?: boolean;
  readonly isMenu?: boolean;
  readonly isTabList?: boolean;
  readonly useEventAsContext?: boolean;
  readonly hoverDelegate?: unknown;
}

export interface IActionViewItemOptions extends IBaseActionViewItemOptions {
  icon?: boolean;
  label?: boolean;
  readonly keybinding?: string | null;
  readonly keybindingNotRenderedWithLabel?: boolean;
  readonly toggleStyles?: unknown;
}

export interface IContextMenuDelegate {
  /**
   * The anchor where to position the context view.
   * Use a `HTMLElement` to position the view at the element,
   * a `StandardMouseEvent` to position it at the mouse position
   * or an `ContextMenuLocation` to position it at a specific location.
   */
  getAnchor(): HTMLElement | MouseEvent | ContextMenuLocation;
  getActions(): readonly IAction[];
  getCheckedActionsRepresentation?(action: IAction): "radio" | "checkbox";
  getActionViewItem?(
    action: IAction,
    options: IActionViewItemOptions,
  ): unknown | undefined;
  getActionsContext?(event?: unknown): unknown;
  getKeyBinding?(action: IAction): unknown | undefined;
  getMenuClassName?(): string;
  onHide?(didCancel: boolean): void;
  actionRunner?: unknown;
  skipTelemetry?: boolean;
  autoSelectFirstItem?: boolean;
  anchorAlignment?: AnchorAlignment;
  anchorAxisAlignment?: AnchorAxisAlignment;
  domForShadowRoot?: HTMLElement;
  /**
   * custom context menus with higher layers are rendered higher in z-index order
   */
  layer?: number;
}

// Monaco's IAction interface (simplified)
export interface IAction {
  readonly id: string;
  label: string;
  tooltip: string;
  class: string | undefined;
  enabled: boolean;
  checked?: boolean;
  run(...args: unknown[]): unknown;
}

export const enum AnchorAlignment {
  LEFT,
  RIGHT,
}

export const enum AnchorPosition {
  BELOW,
  ABOVE,
}

export const enum AnchorAxisAlignment {
  VERTICAL,
  HORIZONTAL,
}

// Monaco's anchor types
export interface IAnchor {
  x: number;
  y: number;
  width?: number;
  height?: number;
}
export interface IContextViewDelegate {
  canRelayout?: boolean; // Default: true

  /**
   * The anchor where to position the context view.
   * Use a `HTMLElement` to position the view at the element,
   * a `StandardMouseEvent` to position it at the mouse position
   * or an `IAnchor` to position it at a specific location.
   */
  getAnchor(): HTMLElement | MouseEvent | IAnchor;
  render(container: HTMLElement): IDisposable;
  onDOMEvent?(e: any, activeElement: HTMLElement): void;
  onHide?(data?: any): void;
  focus?(): void;
  anchorAlignment?: AnchorAlignment;
  anchorAxisAlignment?: AnchorAxisAlignment;

  // context views with higher layers are rendered over contet views with lower layers
  layer?: number; // Default: 0
}

export interface IOpenContextView {
  close: () => void;
}

export interface IContextMenuService {
  readonly _serviceBrand: undefined;

  readonly onDidShowContextMenu: Event;
  readonly onDidHideContextMenu: Event;

  showContextMenu(
    delegate: IContextMenuDelegate | IContextMenuMenuDelegate,
  ): void;
}

export interface IMenuActionOptions {
  arg?: unknown;
  shouldForwardArgs?: boolean;
  renderShortTitle?: boolean;
}

export type IContextMenuMenuDelegate = {
  /**
   * The MenuId that should be used to populate the context menu.
   */
  menuId?: string;
  /**
   * Optional options how menu actions are invoked
   */
  menuActionOptions?: IMenuActionOptions;
  /**
   * Optional context key service which drives the given menu
   */
  contextKeyService?: unknown;

  /**
   * Optional getter for extra actions. They will be prepended to the menu actions.
   */
  getActions?(): IAction[];
} & Omit<IContextMenuDelegate, "getActions">;

// Keybinding service interface for getting keybinding labels
interface IKeybindingService {
  lookupKeybinding(actionId: string): { getLabel(): string | null } | undefined;
}

// Callback type for showing the context menu
export type ShowContextMenuCallback = (state: ContextMenuState) => void;

// Store the callback globally so the service can call it
let showContextMenuCallback: ShowContextMenuCallback | null = null;
let keybindingService: IKeybindingService | null = null;

/**
 * Set the callback that will be called when the context menu should be shown.
 * This should be called once when the MonacoContextMenuProvider mounts.
 */
export function setContextMenuCallback(
  callback: ShowContextMenuCallback | null,
): void {
  showContextMenuCallback = callback;
}

/**
 * Set the keybinding service for resolving keybinding labels.
 * This should be called after Monaco initializes.
 */
export function setKeybindingService(service: IKeybindingService | null): void {
  keybindingService = service;
}

/**
 * Get keybinding label for an action
 */
function getKeybindingLabel(actionId: string): string | undefined {
  if (!keybindingService) return undefined;
  const keybinding = keybindingService.lookupKeybinding(actionId);
  return keybinding?.getLabel() ?? undefined;
}

/**
 * Normalize anchor to x/y coordinates
 */
function normalizeAnchor(anchor: HTMLElement | MouseEvent | IAnchor): {
  x: number;
  y: number;
} {
  if ("x" in anchor && "y" in anchor && typeof anchor.x === "number") {
    return { x: anchor.x, y: anchor.y };
  }

  if (anchor instanceof Event) {
    return { x: anchor.clientX, y: anchor.clientY };
  }

  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }

  if ("target" in anchor && anchor.target instanceof HTMLElement) {
    const rect = anchor.target.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }

  // Fallback
  return { x: 0, y: 0 };
}

/** Function type for getting keybinding from delegate */
type GetKeyBindingFn = (action: IAction) => { getLabel(): string | null } | undefined;

/**
 * Convert Monaco IAction to our ContextMenuAction format
 */
function convertAction(
  action: IAction,
  getKeyBinding?: GetKeyBindingFn,
): ContextMenuAction {
  // Get keybinding label from delegate's getKeyBinding or fall back to our service
  const keybinding = getKeyBinding?.(action)?.getLabel() ?? getKeybindingLabel(action.id);

  return {
    id: action.id,
    label: action.label,
    enabled: action.enabled,
    checked: action.checked,
    keybinding: keybinding ?? undefined,
    run: () => action.run(),
  };
}

/**
 * Check if an action is a SubmenuAction (has nested actions)
 */
function isSubmenuAction(
  action: IAction,
): action is IAction & { _actions: IAction[] } {
  return "_actions" in action && Array.isArray((action as any)._actions);
}

/**
 * Check if an action is a separator
 */
function isSeparator(action: IAction): boolean {
  return action.id === "vs.actions.separator" || action.class === "separator";
}

/**
 * Process Monaco actions into our ContextMenuAction format.
 * Automatically detects SubmenuAction types and converts them to nested menus.
 */
function processActions(
  actions: readonly IAction[],
  getKeyBinding?: GetKeyBindingFn,
): ContextMenuAction[] {
  const result: ContextMenuAction[] = [];

  for (const action of actions) {
    if (isSeparator(action)) {
      // Add separator
      result.push({
        id: action.id,
        label: "---",
        enabled: false,
        run: () => {},
        isSeparator: true,
      });
    } else if (isSubmenuAction(action)) {
      // This is a SubmenuAction with nested _actions
      const submenuActions = processActions(action._actions, getKeyBinding);
      result.push({
        id: action.id,
        label: action.label,
        enabled: submenuActions.some((item) => item.enabled),
        run: () => {},
        submenu: submenuActions,
      });
    } else {
      // Regular action
      result.push(convertAction(action, getKeyBinding));
    }
  }

  return result;
}

/**
 * Simple event emitter for Monaco's event interface
 */
class SimpleEmitter<T> {
  private listeners: Set<(e: T) => void> = new Set();

  get event(): (listener: (e: T) => void) => IDisposable {
    return (listener: (e: T) => void) => {
      this.listeners.add(listener);
      return {
        dispose: () => this.listeners.delete(listener),
      };
    };
  }

  fire(event: T): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

/**
 * Create a custom context menu service for Monaco Editor.
 * Pass this to monaco.editor.create() as the third parameter.
 */
export function createContextMenuService() {
  const onDidShowEmitter = new SimpleEmitter<void>();
  const onDidHideEmitter = new SimpleEmitter<void>();

  return {
    _serviceBrand: undefined as undefined,
    onDidShowContextMenu: onDidShowEmitter.event,
    onDidHideContextMenu: onDidHideEmitter.event,

    showContextMenu: (delegate: IContextMenuDelegate) => {
      if (!showContextMenuCallback) {
        console.warn("[Monaco] Context menu callback not set");
        return;
      }

      const anchorCoords = normalizeAnchor(delegate.getAnchor());
      const rawActions = delegate.getActions();
      const getKeyBinding = delegate.getKeyBinding as GetKeyBindingFn | undefined;
      const actions = processActions(rawActions, getKeyBinding);

      // Fire show event
      onDidShowEmitter.fire();

      showContextMenuCallback({
        visible: true,
        x: anchorCoords.x,
        y: anchorCoords.y,
        actions,
        onHide: (didCancel: boolean) => {
          // Fire hide event
          onDidHideEmitter.fire();
          // Call original onHide
          delegate.onHide?.(didCancel);
        },
      });
    },
  };
}

/**
 * Get the context menu service override object for Monaco editor creation.
 * Usage: monaco.editor.create(container, options, { contextMenuService: getContextMenuServiceOverride() })
 */
export function getContextMenuServiceOverride() {
  return {
    contextMenuService: createContextMenuService(),
  };
}
