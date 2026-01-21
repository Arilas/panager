/**
 * Go to Line Dialog (Cmd+G)
 *
 * Dialog for jumping to a specific line using cmdk.
 */

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { Hash } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useEditorStore } from "../../stores/editor";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";

interface GoToLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoToLineDialog({ open, onOpenChange }: GoToLineDialogProps) {
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);
  const activeEditor = useEditorStore((s) => s.activeEditor);
  const useLiquidGlassEnabled = useLiquidGlass();

  const [value, setValue] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setValue("");
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    const line = parseInt(value, 10);
    if (!isNaN(line) && line > 0) {
      // Update IDE store for status bar display
      setCursorPosition({ line, column: 1 });

      // Actually navigate the editor to the line
      if (activeEditor) {
        activeEditor.setPosition({ lineNumber: line, column: 1 });
        activeEditor.revealLineInCenter(line);
        activeEditor.focus();
      }

      onOpenChange(false);
    }
  }, [value, setCursorPosition, activeEditor, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Go to Line"
      overlayClassName={
        useLiquidGlassEnabled
          ? "bg-transparent!"
          : "bg-black/40 backdrop-blur-xs"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[400px] -translate-x-1/2",
        "shadow-2xl overflow-hidden",
        useLiquidGlassEnabled
          ? "liquid-glass-command liquid-glass-animate"
          : [
              "rounded-xl",
              "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
            ]
      )}
    >
      <div
        className={cn(
          "flex items-center px-4",
          useLiquidGlassEnabled
            ? "border-b border-white/10"
            : "border-b border-black/5 dark:border-white/5"
        )}
      >
        <Hash className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <Command.Input
          value={value}
          onValueChange={(v) => setValue(v.replace(/\D/g, ""))}
          onKeyDown={handleKeyDown}
          placeholder="Enter line number..."
          className={cn(
            "flex-1 h-12 px-3 text-[14px] bg-transparent",
            "placeholder:text-muted-foreground/50",
            "focus:outline-hidden"
          )}
        />
      </div>

      <Command.List
        className={cn(
          "max-h-[200px] overflow-y-auto",
          useLiquidGlassEnabled ? "p-1" : "p-2"
        )}
      >
        {value && parseInt(value, 10) > 0 && (
          <Command.Item
            value={`go to line ${value}`}
            onSelect={handleSubmit}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
              "text-[13px] text-foreground/90",
              "aria-selected:bg-primary/10 aria-selected:text-primary",
              "transition-colors"
            )}
          >
            <Hash className="h-4 w-4" />
            <span>Go to line {value}</span>
          </Command.Item>
        )}

        {!value && (
          <div className="py-4 text-center text-[13px] text-muted-foreground/60">
            Type a line number to jump to
          </div>
        )}
      </Command.List>

      <div
        className={cn(
          "flex items-center justify-between px-4 py-2",
          useLiquidGlassEnabled
            ? "border-t border-white/10"
            : "border-t border-black/5 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
              ↵
            </kbd>{" "}
            Go
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
              esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
