import { cn } from "../../../lib/utils";

interface OptionToggleProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function OptionToggle({ label, checked, onChange }: OptionToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full"
    >
      <span className="text-[12px]">{label}</span>
      <div
        className={cn(
          "w-8 h-5 rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-black/20 dark:bg-white/20"
        )}
      >
        <div
          className={cn(
            "w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-3" : "translate-x-0"
          )}
        />
      </div>
    </button>
  );
}
