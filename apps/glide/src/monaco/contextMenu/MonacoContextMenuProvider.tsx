/**
 * Monaco Context Menu Provider
 *
 * Provides global context menu state management for Monaco editors.
 * Place this component near the root of your app to enable custom context menus.
 */

import { useState, useCallback, useEffect } from "react";
import { MonacoContextMenu, type ContextMenuState } from "./MonacoContextMenu";
import { setContextMenuCallback } from "./contextMenuService";

const initialState: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  actions: [],
};

export function MonacoContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuState, setMenuState] = useState<ContextMenuState>(initialState);

  const showContextMenu = useCallback((state: ContextMenuState) => {
    setMenuState(state);
  }, []);

  const hideContextMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Register the callback when mounting
  useEffect(() => {
    setContextMenuCallback(showContextMenu);
    return () => {
      setContextMenuCallback(null);
    };
  }, [showContextMenu]);

  return (
    <>
      {children}
      <MonacoContextMenu state={menuState} onClose={hideContextMenu} />
    </>
  );
}
