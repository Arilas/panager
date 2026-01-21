/**
 * File Tree Context Menu Component
 *
 * Right-click menu for file tree items with actions like create, rename, delete,
 * copy, cut, paste, and reveal in finder.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Scissors,
  Copy,
  Clipboard,
  FolderOpen,
  Terminal,
} from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";
import type { FileEntry } from "../../types";

interface FileTreeContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry; // Used for potential future conditional rendering
  clipboardHasItems: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onRevealInFinder: () => void;
  onOpenInTerminal: () => void;
}

export function FileTreeContextMenu({
  x,
  y,
  entry: _entry, // Currently unused but available for future conditional rendering
  clipboardHasItems,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onCopyPath,
  onCopyRelativePath,
  onRevealInFinder,
  onOpenInTerminal,
}: FileTreeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { useLiquidGlass } = useIdeSettingsContext();
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

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menu = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-9999 min-w-[180px] overflow-hidden p-1",
        useLiquidGlass
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
      {/* Create actions */}
      <MenuItem
        icon={<FilePlus className="w-3.5 h-3.5" />}
        label="New File"
        onClick={() => handleAction(onNewFile)}
      />
      <MenuItem
        icon={<FolderPlus className="w-3.5 h-3.5" />}
        label="New Folder"
        onClick={() => handleAction(onNewFolder)}
      />

      <Separator />

      {/* Edit actions */}
      <MenuItem
        icon={<Pencil className="w-3.5 h-3.5" />}
        label="Rename"
        onClick={() => handleAction(onRename)}
      />
      <MenuItem
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        onClick={() => handleAction(onDelete)}
        danger
      />

      <Separator />

      {/* Clipboard actions */}
      <MenuItem
        icon={<Scissors className="w-3.5 h-3.5" />}
        label="Cut"
        onClick={() => handleAction(onCut)}
      />
      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Copy"
        onClick={() => handleAction(onCopy)}
      />
      <MenuItem
        icon={<Clipboard className="w-3.5 h-3.5" />}
        label="Paste"
        onClick={() => handleAction(onPaste)}
        disabled={!clipboardHasItems}
      />

      <Separator />

      {/* Path actions */}
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

      <Separator />

      {/* External actions */}
      <MenuItem
        icon={<FolderOpen className="w-3.5 h-3.5" />}
        label="Reveal in Finder"
        onClick={() => handleAction(onRevealInFinder)}
      />
      <MenuItem
        icon={<Terminal className="w-3.5 h-3.5" />}
        label="Open in Terminal"
        onClick={() => handleAction(onOpenInTerminal)}
      />
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
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, disabled, danger }: MenuItemProps) {
  const { effectiveTheme } = useIdeSettingsContext();
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
              danger
                ? "text-red-500 hover:bg-red-500/10"
                : isDark
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
