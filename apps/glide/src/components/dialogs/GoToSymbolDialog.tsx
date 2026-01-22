/**
 * Go to Symbol Dialog (Cmd+Shift+O)
 *
 * Dialog for jumping to symbols (functions, classes, etc.) in the current file.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Command } from "cmdk";
import {
  AtSign,
  Box,
  Braces,
  Code2,
  Hash,
  Layers,
  type LucideIcon,
  Puzzle,
  Variable,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useMonacoStore } from "../../stores/monaco";
import { useTabsStore } from "../../stores/tabs";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { parseFileUrl, isFileUrl } from "../../lib/tabs/url";
import { cn } from "../../lib/utils";
import { SymbolKind, type LspDocumentSymbol } from "../../types/lsp";

interface GoToSymbolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Get icon for symbol kind */
function getSymbolIcon(kind: number): LucideIcon {
  switch (kind) {
    case SymbolKind.Function:
    case SymbolKind.Method:
    case SymbolKind.Constructor:
      return Braces;
    case SymbolKind.Class:
    case SymbolKind.Interface:
    case SymbolKind.Struct:
      return Box;
    case SymbolKind.Enum:
    case SymbolKind.EnumMember:
      return Layers;
    case SymbolKind.Variable:
    case SymbolKind.Field:
    case SymbolKind.Property:
      return Variable;
    case SymbolKind.Constant:
      return Hash;
    case SymbolKind.Module:
    case SymbolKind.Namespace:
    case SymbolKind.Package:
      return Puzzle;
    case SymbolKind.TypeParameter:
      return Code2;
    default:
      return AtSign;
  }
}

/** Get human-readable label for symbol kind */
function getSymbolKindLabel(kind: number): string {
  switch (kind) {
    case SymbolKind.Function:
      return "function";
    case SymbolKind.Method:
      return "method";
    case SymbolKind.Constructor:
      return "constructor";
    case SymbolKind.Class:
      return "class";
    case SymbolKind.Interface:
      return "interface";
    case SymbolKind.Struct:
      return "struct";
    case SymbolKind.Enum:
      return "enum";
    case SymbolKind.EnumMember:
      return "enum member";
    case SymbolKind.Variable:
      return "variable";
    case SymbolKind.Field:
      return "field";
    case SymbolKind.Property:
      return "property";
    case SymbolKind.Constant:
      return "constant";
    case SymbolKind.Module:
      return "module";
    case SymbolKind.Namespace:
      return "namespace";
    case SymbolKind.Package:
      return "package";
    case SymbolKind.TypeParameter:
      return "type parameter";
    default:
      return "symbol";
  }
}

export function GoToSymbolDialog({ open, onOpenChange }: GoToSymbolDialogProps) {
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);
  const activeEditor = useMonacoStore((s) => s.activeEditor);
  const getEditorMetadata = useMonacoStore((s) => s.getEditorMetadata);
  const activeGroupId = useTabsStore((s) => s.activeGroupId);
  const groups = useTabsStore((s) => s.groups);
  const useLiquidGlassEnabled = useLiquidGlass();

  const [search, setSearch] = useState("");

  // Get active file path from tabs store
  const activeFilePath = useMemo(() => {
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeUrl = activeGroup?.activeUrl;
    if (!activeUrl || !isFileUrl(activeUrl)) return null;
    try {
      return parseFileUrl(activeUrl);
    } catch {
      return null;
    }
  }, [groups, activeGroupId]);

  // Get symbols from the active file
  const editorMetadata = activeFilePath ? getEditorMetadata(activeFilePath, activeGroupId) : null;
  const symbols = editorMetadata?.symbols ?? [];
  const symbolsLoading = editorMetadata?.symbolsLoading ?? false;

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    if (!search.trim()) return symbols;
    const query = search.toLowerCase();
    return symbols.filter(
      (symbol: LspDocumentSymbol) =>
        symbol.name.toLowerCase().includes(query) ||
        getSymbolKindLabel(symbol.kind).includes(query)
    );
  }, [symbols, search]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const handleSelectSymbol = useCallback(
    (symbol: LspDocumentSymbol) => {
      // LSP positions are 0-indexed, Monaco is 1-indexed
      const line = symbol.selectionRange.start.line + 1;
      const column = symbol.selectionRange.start.character + 1;

      // Update IDE store for status bar display
      setCursorPosition({ line, column });

      // Navigate the editor to the symbol
      if (activeEditor) {
        activeEditor.setPosition({ lineNumber: line, column });
        activeEditor.revealLineInCenter(line);
        activeEditor.focus();
      }

      onOpenChange(false);
    },
    [setCursorPosition, activeEditor, onOpenChange]
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Go to Symbol"
      overlayClassName={
        useLiquidGlassEnabled
          ? "bg-transparent!"
          : "bg-black/40 backdrop-blur-xs"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[560px] -translate-x-1/2",
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
        <AtSign className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search symbols in file..."
          className={cn(
            "flex-1 h-12 px-3 text-[14px] bg-transparent",
            "placeholder:text-muted-foreground/50",
            "focus:outline-hidden"
          )}
        />
        {symbolsLoading && (
          <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
        )}
      </div>

      <Command.List
        className={cn(
          "max-h-[400px] overflow-y-auto",
          useLiquidGlassEnabled ? "p-1" : "p-2",
          "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5",
          "**:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium",
          "**:[[cmdk-group-heading]]:text-muted-foreground/60 **:[[cmdk-group-heading]]:uppercase",
          "**:[[cmdk-group-heading]]:tracking-wide"
        )}
      >
        <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/60">
          {symbols.length === 0
            ? "No symbols found in this file."
            : "No matching symbols."}
        </Command.Empty>

        {filteredSymbols.length > 0 && (
          <Command.Group heading="Symbols">
            {filteredSymbols.map((symbol: LspDocumentSymbol, index: number) => {
              const Icon = getSymbolIcon(symbol.kind);
              const kindLabel = getSymbolKindLabel(symbol.kind);
              const line = symbol.selectionRange.start.line + 1;

              return (
                <Command.Item
                  key={`${symbol.name}-${index}`}
                  value={`${symbol.name} ${kindLabel}`}
                  onSelect={() => handleSelectSymbol(symbol)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                    "text-[13px] text-foreground/90",
                    "aria-selected:bg-primary/10 aria-selected:text-primary",
                    "transition-colors"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{symbol.name}</span>
                      {symbol.detail && (
                        <span className="text-[11px] text-muted-foreground/50 truncate">
                          {symbol.detail}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50">
                    :{line}
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
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
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
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
