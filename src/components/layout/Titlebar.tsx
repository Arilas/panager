import { useRef, useEffect } from "react";
import { Search, PanelRight, Settings } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { useUIStore } from "../../stores/ui";
import { useSettingsStore } from "../../stores/settings";

interface TitlebarProps {
  onOpenCommandPalette: () => void;
  onSettingsClick: () => void;
}

export function Titlebar({
  onOpenCommandPalette,
  onSettingsClick,
}: TitlebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { rightPanelVisible, searchQuery, toggleRightPanel, setSearchQuery } =
    useUIStore();
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  // Focus search on Cmd+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      inputRef.current?.blur();
    }
    // Open command palette on Cmd+K while in search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      onOpenCommandPalette();
    }
  };

  return (
    <div
      className={cn(
        "titlebar flex items-center gap-2 px-3 select-none",
        useLiquidGlass
          ? "liquid-glass-titlebar"
          : "bg-vibrancy-sidebar"
      )}
      data-tauri-drag-region
    >
      {/* Traffic light spacer - approximately 80px for macOS window controls */}
      <div className="w-[70px] shrink-0" data-tauri-drag-region />

      {/* Center search bar */}
      <div className="flex-1 flex justify-center" data-tauri-drag-region>
        <div
          className={cn(
            "relative flex items-center w-full max-w-[480px]",
            useLiquidGlass
              ? "liquid-glass-input rounded-lg"
              : [
                  "bg-black/4 dark:bg-white/8",
                  "hover:bg-black/6 dark:hover:bg-white/10",
                  "focus-within:bg-black/6 dark:focus-within:bg-white/10",
                  "focus-within:ring-1 focus-within:ring-primary/30",
                  "rounded-lg transition-all"
                ]
          )}
        >
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search projects..."
            className={cn(
              "w-full h-8 pl-9 pr-16 text-[13px] select-text",
              "bg-transparent text-foreground/90",
              "placeholder:text-muted-foreground/50",
              "focus:outline-hidden"
            )}
          />
          <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
            <kbd
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                "bg-black/6 dark:bg-white/8",
                "text-muted-foreground/60"
              )}
            >
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}K
            </kbd>
          </div>
        </div>
      </div>

      {/* Panel toggle and settings */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRightPanel}
          className={cn(
            "h-8 w-8",
            rightPanelVisible
              ? "text-foreground/70"
              : "text-muted-foreground/50"
          )}
          title={`Toggle info panel (${
            navigator.platform.includes("Mac") ? "⌘" : "Ctrl"
          }B)`}
        >
          <PanelRight className="h-4 w-4" />
        </Button>

        {/* Separator */}
        <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Settings button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className="h-8 w-8 text-muted-foreground/70 hover:text-foreground/70"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
