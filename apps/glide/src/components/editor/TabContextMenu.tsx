/**
 * Tab Context Menu Component
 *
 * Right-click menu for editor tabs with actions like close, pin, copy path, etc.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  XCircle,
  Pin,
  PinOff,
  Copy,
  FolderOpen,
  Columns,
} from "lucide-react";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface TabContextMenuProps {
  x: number;
  y: number;
  tabPath: string;
  isPinned: boolean;
  isPreview: boolean;
  onClose: () => void;
  onCloseTab: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onRevealInSidebar: () => void;
}

export function TabContextMenu({
  x,
  y,
  tabPath,
  isPinned,
  isPreview,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onPin,
  onUnpin,
  onCopyPath,
  onCopyRelativePath,
  onRevealInSidebar,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const liquidGlass = useLiquidGlass();
  const [position, setPosition] = useState({ x, y });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport after initial render
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = x;
    let newY = y;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      newX = x - rect.width;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      newY = y - rect.height;
    }

    if (newX !== x || newY !== y) {
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  // Show file-specific actions for regular files and diff tabs (which have a file path)
  const isFilePath = !tabPath.startsWith("chat://");

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menu = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-9999 min-w-[180px] overflow-hidden p-1",
        liquidGlass
          ? "liquid-glass-dropdown"
          : [
              "rounded-lg",
              "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
              "shadow-lg",
            ]
      )}
      style={{ left: position.x, top: position.y }}
    >
      {/* Close actions */}
      <MenuItem
        icon={<X className="w-3.5 h-3.5" />}
        label="Close"
        onClick={() => handleAction(onCloseTab)}
      />
      <MenuItem
        icon={<XCircle className="w-3.5 h-3.5" />}
        label="Close Others"
        onClick={() => handleAction(onCloseOthers)}
      />
      <MenuItem
        icon={<XCircle className="w-3.5 h-3.5" />}
        label="Close All"
        onClick={() => handleAction(onCloseAll)}
      />

      <Separator />

      {/* Pin action */}
      {!isPreview && (
        isPinned ? (
          <MenuItem
            icon={<PinOff className="w-3.5 h-3.5" />}
            label="Unpin Tab"
            onClick={() => handleAction(onUnpin)}
          />
        ) : (
          <MenuItem
            icon={<Pin className="w-3.5 h-3.5" />}
            label="Pin Tab"
            onClick={() => handleAction(onPin)}
          />
        )
      )}

      {/* File-specific actions */}
      {isFilePath && (
        <>
          <Separator />
          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy Path"
            onClick={() => handleAction(onCopyPath)}
          />
          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy Relative Path"
            onClick={() => handleAction(onCopyRelativePath)}
          />
          <MenuItem
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            label="Reveal in Sidebar"
            onClick={() => handleAction(onRevealInSidebar)}
          />
        </>
      )}

      {/* Future: Split view */}
      {isFilePath && (
        <>
          <Separator />
          <MenuItem
            icon={<Columns className="w-3.5 h-3.5" />}
            label="Split Right"
            onClick={() => {}}
            disabled
          />
        </>
      )}
    </div>
  );

  // Use portal to render menu at document body level
  return createPortal(menu, document.body);
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({ icon, label, onClick, disabled }: MenuItemProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-md",
        "transition-colors text-left",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : [
              "cursor-default",
              isDark
                ? "hover:bg-white/10"
                : "hover:bg-black/5",
            ]
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-black/5 dark:bg-white/5" />;
}
