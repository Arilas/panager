/**
 * Search Panel - Full-text search across project files
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  File,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
  CaseSensitive,
  Regex,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore } from "../../stores/files";
import { searchFiles } from "../../lib/tauri-ide";
import { cn } from "../../../lib/utils";
import type { SearchResult } from "../../types";

interface GroupedResults {
  [filePath: string]: SearchResult[];
}

export function SearchPanel() {
  const projectContext = useIdeStore((s) => s.projectContext);
  const openFile = useFilesStore((s) => s.openFile);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const performSearch = useCallback(async () => {
    if (!projectContext || !query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchFiles(
        projectContext.projectPath,
        query,
        caseSensitive,
        useRegex,
        100
      );
      setResults(searchResults);

      // Expand all files by default
      const files = new Set(searchResults.map((r) => r.filePath));
      setExpandedFiles(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [projectContext, query, caseSensitive, useRegex]);

  // Trigger search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(performSearch, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, caseSensitive, useRegex, performSearch]);

  // Group results by file
  const groupedResults: GroupedResults = results.reduce((acc, result) => {
    if (!acc[result.filePath]) {
      acc[result.filePath] = [];
    }
    acc[result.filePath].push(result);
    return acc;
  }, {} as GroupedResults);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleResultClick = (result: SearchResult) => {
    if (!projectContext) return;
    // Convert relative path to full path
    const fullPath = `${projectContext.projectPath}/${result.filePath}`;
    openFile(fullPath);
    // TODO: Jump to line when Monaco supports it
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  // Get display path (relative to project)
  const getDisplayPath = (filePath: string) => {
    if (projectContext) {
      return filePath.replace(projectContext.projectPath + "/", "");
    }
    return filePath;
  };

  const totalMatches = results.length;
  const fileCount = Object.keys(groupedResults).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Search
        </span>
        {loading && (
          <RefreshCw className="w-3.5 h-3.5 text-neutral-500 animate-spin" />
        )}
      </div>

      {/* Search input */}
      <div className="px-3 py-2 border-b border-neutral-800 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in files..."
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded focus:outline-hidden focus:border-neutral-600 placeholder:text-neutral-500"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-neutral-700 rounded"
            >
              <X className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
        </div>

        {/* Search options */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={cn(
              "p-1.5 rounded transition-colors",
              caseSensitive
                ? "bg-neutral-700 text-neutral-200"
                : "text-neutral-500 hover:bg-neutral-800"
            )}
            title="Case Sensitive"
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={cn(
              "p-1.5 rounded transition-colors",
              useRegex
                ? "bg-neutral-700 text-neutral-200"
                : "text-neutral-500 hover:bg-neutral-800"
            )}
            title="Use Regular Expression"
          >
            <Regex className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Results summary */}
      {query.trim() && !loading && (
        <div className="px-3 py-1.5 text-xs text-neutral-500 border-b border-neutral-800">
          {totalMatches > 0
            ? `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""}`
            : "No results found"}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border-b border-neutral-800">
          {error}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-auto">
        {Object.entries(groupedResults).map(([filePath, fileResults]) => (
          <div key={filePath}>
            {/* File header */}
            <div
              onClick={() => toggleFile(filePath)}
              className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-neutral-800/50 sticky top-0 bg-neutral-900"
            >
              {expandedFiles.has(filePath) ? (
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              )}
              <File className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-sm text-neutral-300 truncate flex-1">
                {getDisplayPath(filePath)}
              </span>
              <span className="text-xs text-neutral-600 shrink-0">
                {fileResults.length}
              </span>
            </div>

            {/* File results */}
            {expandedFiles.has(filePath) && (
              <div className="ml-4">
                {fileResults.map((result, idx) => (
                  <div
                    key={`${result.filePath}-${result.lineNumber}-${idx}`}
                    onClick={() => handleResultClick(result)}
                    className="flex items-start gap-2 px-2 py-1 cursor-pointer hover:bg-neutral-800/50 text-sm"
                  >
                    <span className="text-neutral-600 shrink-0 w-8 text-right">
                      {result.lineNumber}
                    </span>
                    <span className="text-neutral-400 truncate whitespace-pre">
                      {highlightMatch(result.lineContent, result.matchStart, result.matchEnd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {!query.trim() && (
          <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm py-8">
            <div className="text-center">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Search across all files</p>
              <p className="text-xs text-neutral-600 mt-1">
                Type to start searching
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to highlight the matched portion of text
function highlightMatch(
  text: string,
  matchStart: number,
  matchEnd: number
): React.ReactNode {
  if (matchStart < 0 || matchEnd <= matchStart) {
    return text;
  }

  const before = text.slice(0, matchStart);
  const match = text.slice(matchStart, matchEnd);
  const after = text.slice(matchEnd);

  return (
    <>
      {before}
      <span className="bg-yellow-500/30 text-yellow-200">{match}</span>
      {after}
    </>
  );
}
