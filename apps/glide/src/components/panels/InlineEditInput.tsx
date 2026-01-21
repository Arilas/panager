/**
 * Inline Edit Input Component
 *
 * Used for creating new files/folders and renaming existing ones inline in the file tree.
 * Matches the styling of tree items for a seamless experience.
 */

import { useEffect, useRef, useState } from "react";
import { File, Folder } from "lucide-react";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../lib/utils";

interface InlineEditInputProps {
  /** Initial value for the input (used for renaming) */
  initialValue?: string;
  /** Whether this is for a directory (affects icon) */
  isDirectory: boolean;
  /** Called when the user confirms the input (Enter or valid blur) */
  onConfirm: (name: string) => void;
  /** Called when the user cancels (Escape or empty blur) */
  onCancel: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Depth in tree for proper indentation */
  depth: number;
}

export function InlineEditInput({
  initialValue = "",
  isDirectory,
  onConfirm,
  onCancel,
  placeholder,
  depth,
}: InlineEditInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const isHandledRef = useRef(false); // Track if we've already handled confirm/cancel
  const scrollParentRef = useRef<Element | null>(null);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";

  // Auto-focus and select on mount, with preventScroll to avoid tree jumping
  useEffect(() => {
    // Cache the scroll parent reference on mount
    scrollParentRef.current = containerRef.current?.closest(".overflow-auto") ?? null;

    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      // For renaming, select just the name without extension
      if (initialValue && !isDirectory) {
        const lastDot = initialValue.lastIndexOf(".");
        if (lastDot > 0) {
          inputRef.current.setSelectionRange(0, lastDot);
        } else {
          inputRef.current.select();
        }
      } else {
        inputRef.current.select();
      }
    }
  }, [initialValue, isDirectory]);

  /** Save scroll position and restore after callback */
  const withScrollPreserve = (callback: () => void) => {
    const scrollParent = scrollParentRef.current;
    if (scrollParent) {
      const scrollTop = scrollParent.scrollTop;
      callback();
      // Restore scroll position multiple times to handle React re-renders
      scrollParent.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        scrollParent.scrollTop = scrollTop;
        // Double RAF to handle React's batched updates
        requestAnimationFrame(() => {
          scrollParent.scrollTop = scrollTop;
        });
      });
    } else {
      callback();
    }
  };

  const validate = (name: string): string | null => {
    if (!name.trim()) {
      return "Name cannot be empty";
    }
    if (name.includes("/") || name.includes("\\")) {
      return "Name cannot contain slashes";
    }
    if (name === "." || name === "..") {
      return "Invalid name";
    }
    // Check for other invalid characters on different platforms
    if (/[<>:"|?*]/.test(name)) {
      return "Name contains invalid characters";
    }
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isHandledRef.current) return;
      const trimmedValue = value.trim();
      const validationError = validate(trimmedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
      isHandledRef.current = true;
      withScrollPreserve(() => onConfirm(trimmedValue));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (isHandledRef.current) return;
      isHandledRef.current = true;
      withScrollPreserve(onCancel);
    }
  };

  const handleBlur = () => {
    // If already handled via keyboard, don't process blur
    if (isHandledRef.current) return;
    isHandledRef.current = true;

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      withScrollPreserve(onCancel);
      return;
    }
    const validationError = validate(trimmedValue);
    if (validationError) {
      withScrollPreserve(onCancel);
      return;
    }
    withScrollPreserve(() => onConfirm(trimmedValue));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setError(null);
  };

  const indentSize = 16;
  const baseIndent = 12;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center py-0.5 pr-2 text-sm",
        isDark ? "bg-white/5" : "bg-black/5"
      )}
      style={{ paddingLeft: baseIndent }}
    >
      {/* Indentation spacer */}
      {depth > 0 && <div style={{ width: depth * indentSize }} className="shrink-0" />}

      {/* Chevron placeholder */}
      <span className="w-4 h-4 shrink-0" />

      {/* Icon */}
      {isDirectory ? (
        <Folder className="w-4 h-4 shrink-0 text-amber-500/80" />
      ) : (
        <File
          className={cn(
            "w-4 h-4 shrink-0",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        />
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          "flex-1 ml-1 px-1 py-0 text-sm bg-transparent outline-none",
          "border rounded",
          error
            ? "border-red-500"
            : isDark
              ? "border-white/20 focus:border-white/40"
              : "border-black/20 focus:border-black/40"
        )}
        style={{ minWidth: 100 }}
      />
    </div>
  );
}
