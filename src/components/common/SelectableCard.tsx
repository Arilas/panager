import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectableCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SelectableCard({
  selected,
  onClick,
  title,
  subtitle,
  className,
}: SelectableCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between",
        "px-3 py-2.5 rounded-lg text-left",
        "transition-colors",
        selected
          ? "bg-primary/10 border border-primary/20"
          : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]",
        className
      )}
    >
      <div>
        <div className="text-[13px] font-medium">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}
