import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";

interface SelectableOptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function SelectableOptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
  disabled = false,
  children,
}: SelectableOptionCardProps) {
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full p-3 text-left transition-all",
        useLiquidGlass
          ? [
              selected
                ? "liquid-glass-scope border-2 border-primary/50"
                : "liquid-glass-subtle",
              "rounded-xl"
            ]
          : [
              "rounded-lg border-2",
              selected
                ? "border-primary bg-primary/5"
                : "border-black/10 dark:border-white/10 bg-black/2 dark:bg-white/2",
              !disabled && !selected && "hover:border-black/20 dark:hover:border-white/20 hover:bg-black/4 dark:hover:bg-white/4",
            ],
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
              selected
                ? "bg-primary/10 text-primary"
                : useLiquidGlass
                  ? "bg-white/20 dark:bg-white/10 text-muted-foreground"
                  : "bg-black/5 dark:bg-white/10 text-muted-foreground"
            )}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-[13px] font-medium",
                selected ? "text-primary" : "text-foreground/90"
              )}
            >
              {title}
            </p>
            {selected && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
      </div>
      {children && (
        <div className="mt-3 pl-11" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </button>
  );
}
