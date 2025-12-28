import { useEffect, useState } from "react";
import { Plus, Settings, Search, Pencil, Trash2, Link } from "lucide-react";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/DropdownMenu";
import { EditScopeDialog } from "../scopes/EditScopeDialog";
import { DeleteScopeDialog } from "../scopes/DeleteScopeDialog";
import { ScopeLinksDialog } from "../scopes/ScopeLinksDialog";
import type { ScopeWithLinks } from "../../types";

interface SidebarProps {
  onSettingsClick: () => void;
  onNewScopeClick: () => void;
  onSearchClick: () => void;
}

export function Sidebar({
  onSettingsClick,
  onNewScopeClick,
  onSearchClick,
}: SidebarProps) {
  const { scopes, currentScopeId, setCurrentScope, fetchScopes, loading } =
    useScopesStore();
  const collapsed = false; // TODO: Add collapse toggle

  const [editingScope, setEditingScope] = useState<ScopeWithLinks | null>(null);
  const [deletingScope, setDeletingScope] = useState<ScopeWithLinks | null>(null);
  const [linksScope, setLinksScope] = useState<ScopeWithLinks | null>(null);

  useEffect(() => {
    fetchScopes();
  }, [fetchScopes]);

  return (
    <div
      className={cn(
        "flex flex-col h-full border-r transition-all bg-vibrancy-sidebar",
        "border-black/10 dark:border-white/10",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Titlebar drag region - space for traffic lights */}
      <div className="titlebar-drag-region" data-tauri-drag-region />

      {/* Search Button */}
      <div className="px-3 pb-2">
        <button
          onClick={onSearchClick}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px]",
            "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
            "text-muted-foreground transition-colors no-drag",
            collapsed && "justify-center px-0"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          {!collapsed && <span>Search</span>}
          {!collapsed && (
            <kbd className="ml-auto text-[10px] text-muted-foreground/60 font-medium">
              ⌘O
            </kbd>
          )}
        </button>
      </div>

      {/* Scopes List */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between mb-1.5 px-1">
          {!collapsed && (
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              Scopes
            </span>
          )}
          <button
            onClick={onNewScopeClick}
            className={cn(
              "p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors no-drag",
              collapsed && "mx-auto"
            )}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : scopes.length === 0 ? (
          <div className="text-center py-6 px-2">
            {!collapsed && (
              <p className="text-[12px] text-muted-foreground/70">
                No scopes yet
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {scopes.map((scopeWithLinks) => (
              <DropdownMenu key={scopeWithLinks.scope.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={() => setCurrentScope(scopeWithLinks.scope.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors no-drag",
                      currentScopeId === scopeWithLinks.scope.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/10"
                    )}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: scopeWithLinks.scope.color || "#6b7280",
                      }}
                    />
                    {!collapsed && (
                      <span className="truncate">{scopeWithLinks.scope.name}</span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                  <DropdownMenuItem
                    onClick={() => setEditingScope(scopeWithLinks)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit Scope
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLinksScope(scopeWithLinks)}
                  >
                    <Link className="h-3.5 w-3.5 mr-2" />
                    Manage Links
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeletingScope(scopeWithLinks)}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete Scope
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-black/5 dark:border-white/5">
        <button
          onClick={onSettingsClick}
          className={cn(
            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px]",
            "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors no-drag",
            collapsed && "justify-center px-0"
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Scope Dialogs */}
      <EditScopeDialog
        scope={editingScope}
        open={!!editingScope}
        onOpenChange={(open) => !open && setEditingScope(null)}
      />
      <DeleteScopeDialog
        scope={deletingScope}
        open={!!deletingScope}
        onOpenChange={(open) => !open && setDeletingScope(null)}
      />
      <ScopeLinksDialog
        scope={linksScope}
        open={!!linksScope}
        onOpenChange={(open) => !open && setLinksScope(null)}
      />
    </div>
  );
}
