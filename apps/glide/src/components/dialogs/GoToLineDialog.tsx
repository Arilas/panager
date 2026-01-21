/**
 * Go to Line Dialog (Cmd+G)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useIdeStore } from "../../stores/ide";

export function GoToLineDialog() {
  const showGoToLine = useIdeStore((s) => s.showGoToLine);
  const setShowGoToLine = useIdeStore((s) => s.setShowGoToLine);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);

  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (showGoToLine) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showGoToLine]);

  const handleSubmit = useCallback(() => {
    const line = parseInt(value, 10);
    if (!isNaN(line) && line > 0) {
      setCursorPosition({ line, column: 1 });
      setShowGoToLine(false);
    }
  }, [value, setCursorPosition, setShowGoToLine]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowGoToLine(false);
      }
    },
    [handleSubmit, setShowGoToLine]
  );

  if (!showGoToLine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowGoToLine(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3">
          <label className="block text-xs text-neutral-400 mb-2">
            Go to Line
          </label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            placeholder="Enter line number"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden focus:border-neutral-600"
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-neutral-800 flex justify-end gap-2">
          <button
            onClick={() => setShowGoToLine(false)}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
