import { cn } from "../../../lib/utils";

interface OptionSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function OptionSelect({
  label,
  value,
  onChange,
  options,
}: OptionSelectProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "px-2 py-1 rounded text-[11px]",
          "bg-white dark:bg-white/10",
          "border border-black/10 dark:border-white/10",
          "focus:outline-none focus:ring-1 focus:ring-primary/50"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
