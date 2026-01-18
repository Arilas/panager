import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function FormSelect({
  className,
  children,
  ...props
}: FormSelectProps) {
  return (
    <select
      className={cn(
        "w-full px-3 py-2 rounded-md text-[13px]",
        "bg-white dark:bg-white/5",
        "border border-black/10 dark:border-white/10",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "appearance-none cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
