import { cn } from "../../lib/utils";

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        checked && !disabled
          ? "bg-primary/10 border border-primary/20"
          : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
      )}
    >
      <ToggleSwitch checked={checked && !disabled} />
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {description}
        </div>
      </div>
    </button>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  className?: string;
}

export function ToggleSwitch({ checked, className }: ToggleSwitchProps) {
  return (
    <div
      className={cn(
        "w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 mt-0.5",
        checked ? "bg-primary" : "bg-black/20 dark:bg-white/20",
        className
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </div>
  );
}
