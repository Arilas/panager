/**
 * Quick Open Dialog (Cmd+P)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, File } from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { searchFileNames } from "../../lib/tauri-ide";
import { cn } from "../../lib/utils";

export function QuickOpenDialog() {
  const showQuickOpen = useIdeStore((s) => s.showQuickOpen);
  const setShowQuickOpen = useIdeStore((s) => s.setShowQuickOpen);
  const projectContext = useIdeStore((s) => s.projectContext);
  const openFile = useFilesStore((s) => s.openFile);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (showQuickOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showQuickOpen]);

  // Search files
  useEffect(() => {
    if (!showQuickOpen || !projectContext || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const files = await searchFileNames(
          projectContext.projectPath,
          query,
          20
        );
        setResults(files);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [query, projectContext, showQuickOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex] && projectContext) {
            const fullPath = `${projectContext.projectPath}/${results[selectedIndex]}`;
            openFile(fullPath);
            setShowQuickOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowQuickOpen(false);
          break;
      }
    },
    [results, selectedIndex, projectContext, openFile, setShowQuickOpen]
  );

  if (!showQuickOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowQuickOpen(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
          <Search className="w-4 h-4 text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {results.length === 0 && query.trim() && !loading ? (
            <div className="px-4 py-6 text-center text-neutral-500 text-sm">
              No files found
            </div>
          ) : (
            results.map((file, index) => (
              <div
                key={file}
                onClick={() => {
                  if (projectContext) {
                    const fullPath = `${projectContext.projectPath}/${file}`;
                    openFile(fullPath);
                    setShowQuickOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 cursor-pointer",
                  index === selectedIndex
                    ? "bg-neutral-800"
                    : "hover:bg-neutral-800/50"
                )}
              >
                <File className="w-4 h-4 text-neutral-500 shrink-0" />
                <span className="text-sm truncate">{file}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-500">
          <span className="mr-4">
            <kbd className="px-1 bg-neutral-800 rounded">↑↓</kbd> Navigate
          </span>
          <span className="mr-4">
            <kbd className="px-1 bg-neutral-800 rounded">↵</kbd> Open
          </span>
          <span>
            <kbd className="px-1 bg-neutral-800 rounded">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
