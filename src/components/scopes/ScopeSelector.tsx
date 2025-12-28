import { ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useScopesStore } from "../../stores/scopes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "../ui/DropdownMenu";

interface ScopeSelectorProps {
  onNewScopeClick: () => void;
}

export function ScopeSelector({ onNewScopeClick }: ScopeSelectorProps) {
  const { scopes, currentScopeId, setCurrentScope, getCurrentScope } =
    useScopesStore();

  const currentScope = getCurrentScope();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg",
            "bg-black/[0.03] dark:bg-white/[0.06]",
            "hover:bg-black/[0.06] dark:hover:bg-white/[0.10]",
            "transition-colors text-left min-w-[180px]"
          )}
        >
          {currentScope ? (
            <>
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: currentScope.scope.color || "#6b7280",
                }}
              />
              <span className="text-[14px] font-medium text-foreground/90 truncate flex-1">
                {currentScope.scope.name}
              </span>
            </>
          ) : (
            <span className="text-[14px] text-muted-foreground">
              Select a scope
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Scopes</DropdownMenuLabel>

        {scopes.length === 0 ? (
          <div className="px-2 py-3 text-center">
            <p className="text-[12px] text-muted-foreground/70">
              No scopes yet
            </p>
          </div>
        ) : (
          scopes.map((scopeWithLinks) => (
            <DropdownMenuItem
              key={scopeWithLinks.scope.id}
              onClick={() => setCurrentScope(scopeWithLinks.scope.id)}
              className="flex items-center gap-2.5"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: scopeWithLinks.scope.color || "#6b7280",
                }}
              />
              <span className="flex-1 truncate">{scopeWithLinks.scope.name}</span>
              {currentScopeId === scopeWithLinks.scope.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onNewScopeClick} className="text-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Scope
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
