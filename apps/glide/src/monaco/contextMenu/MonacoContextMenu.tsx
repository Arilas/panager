/**
 * Monaco Context Menu Component
 *
 * Custom context menu for Monaco editor that matches the app's design.
 * Replaces Monaco's built-in context menu with our own React component.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import {
  useEffectiveTheme,
  useLiquidGlass,
} from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import { useEditorStore } from "../../stores/editor";

export interface ContextMenuAction {
  id: string;
  label: string;
  enabled: boolean;
  checked?: boolean;
  run: () => void;
  keybinding?: string;
  submenu?: ContextMenuAction[];
  isSeparator?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onHide?: (didCancel: boolean) => void;
}

interface MonacoContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

export function MonacoContextMenu({ state, onClose }: MonacoContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const liquidGlass = useLiquidGlass();
  const [position, setPosition] = useState({ x: state.x, y: state.y });
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!state.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        state.onHide?.(true);
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        state.onHide?.(true);
        onClose();
      }
    };

    // Use setTimeout to avoid closing immediately from the right-click event
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.visible, state.onHide, onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current || !state.visible) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = state.x;
    let newY = state.y;

    if (state.x + rect.width > viewportWidth) {
      newX = state.x - rect.width;
    }

    if (state.y + rect.height > viewportHeight) {
      newY = Math.max(0, viewportHeight - rect.height - 8);
    }

    if (newX !== state.x || newY !== state.y) {
      setPosition({ x: newX, y: newY });
    }
  }, [state.x, state.y, state.visible]);

  // Reset position when menu opens at new location
  useEffect(() => {
    setPosition({ x: state.x, y: state.y });
    setOpenSubmenuId(null);
  }, [state.x, state.y, state.visible]);

  const handleAction = useCallback(
    (action: ContextMenuAction) => {
      if (!action.enabled) return;
      // Close the menu first
      state.onHide?.(false);
      onClose();
      // Run the action after focusing the editor
      requestAnimationFrame(() => {
        // Get the active editor from the store and focus it
        const activeEditor = useEditorStore.getState().activeEditor;
        if (activeEditor) {
          activeEditor.focus();
        }
        // Run the action after focus is restored
        requestAnimationFrame(() => {
          action.run();
        });
      });
    },
    [state.onHide, onClose],
  );

  if (!state.visible) return null;

  const menu = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-9999 min-w-[200px] overflow-hidden p-1",
        liquidGlass
          ? "liquid-glass-dropdown"
          : [
              "rounded-lg",
              "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
              "shadow-lg",
            ],
      )}
      style={{ left: position.x, top: position.y }}
    >
      {state.actions.map((action, index) => {
        // Separator
        if (action.isSeparator || action.id === "vs.actions.separator") {
          if (index === 0) {
            return null;
          }
          return <Separator key={`separator-${index}`} />;
        }

        // Submenu
        if (action.submenu && action.submenu.length > 0) {
          return (
            <SubmenuItem
              key={action.id}
              action={action}
              isOpen={openSubmenuId === action.id}
              onOpen={() => setOpenSubmenuId(action.id)}
              onClose={() => setOpenSubmenuId(null)}
              onAction={handleAction}
              parentRef={menuRef}
            />
          );
        }

        // Regular menu item
        return (
          <MenuItem
            key={action.id}
            action={action}
            onClick={() => handleAction(action)}
          />
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}

interface MenuItemProps {
  action: ContextMenuAction;
  onClick: () => void;
}

function MenuItem({ action, onClick }: MenuItemProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <button
      onClick={onClick}
      disabled={!action.enabled}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] rounded-md",
        "transition-colors text-left",
        !action.enabled
          ? "opacity-40 cursor-not-allowed"
          : [
              "cursor-default",
              isDark ? "hover:bg-white/10" : "hover:bg-black/5",
            ],
      )}
    >
      <span className="truncate">{action.label}</span>
      {action.keybinding && (
        <span className="text-[11px] opacity-50 ml-4 shrink-0">
          {action.keybinding}
        </span>
      )}
    </button>
  );
}

interface SubmenuItemProps {
  action: ContextMenuAction;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

function SubmenuItem({
  action,
  isOpen,
  onOpen,
  onClose,
  onAction,
  parentRef,
}: SubmenuItemProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";
  const liquidGlass = useLiquidGlass();
  const itemRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  // Calculate submenu position when opening
  useEffect(() => {
    if (!isOpen || !itemRef.current || !parentRef.current) return;

    const itemRect = itemRef.current.getBoundingClientRect();
    const parentRect = parentRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Position to the right by default
    let x = parentRect.right - 4;
    let y = itemRect.top;

    // If not enough space on right, position to the left
    if (x + 200 > viewportWidth) {
      x = parentRect.left - 200 + 4;
    }

    setSubmenuPosition({ x, y });
  }, [isOpen, parentRef]);

  // Adjust submenu vertical position after render
  useEffect(() => {
    if (!isOpen || !submenuRef.current) return;

    const rect = submenuRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.bottom > viewportHeight) {
      setSubmenuPosition((prev) => ({
        ...prev,
        y: Math.max(0, viewportHeight - rect.height - 8),
      }));
    }
  }, [isOpen]);

  return (
    <div onMouseEnter={onOpen} onMouseLeave={onClose} className="relative">
      <button
        ref={itemRef}
        disabled={!action.enabled}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] rounded-md",
          "transition-colors text-left",
          !action.enabled
            ? "opacity-40 cursor-not-allowed"
            : [
                "cursor-default",
                isOpen
                  ? isDark
                    ? "bg-white/10"
                    : "bg-black/5"
                  : isDark
                    ? "hover:bg-white/10"
                    : "hover:bg-black/5",
              ],
        )}
      >
        <span className="truncate">{action.label}</span>
        <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
      </button>

      {isOpen && action.submenu && (
        <div
          ref={submenuRef}
          className={cn(
            "fixed z-9999 min-w-[200px] overflow-hidden p-1",
            liquidGlass
              ? "liquid-glass-dropdown"
              : [
                  "rounded-lg",
                  "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
                  "border border-black/10 dark:border-white/10",
                  "shadow-lg",
                ],
          )}
          style={{ left: submenuPosition.x, top: submenuPosition.y }}
        >
          {action.submenu.map((subAction, index) => {
            if (
              subAction.isSeparator ||
              subAction.id === "vs.actions.separator"
            ) {
              return <Separator key={`separator-${index}`} />;
            }
            return (
              <MenuItem
                key={subAction.id}
                action={subAction}
                onClick={() => onAction(subAction)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-black/5 dark:bg-white/5" />;
}
