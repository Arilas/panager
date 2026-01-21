import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface FormLabelProps {
  children: ReactNode;
  icon?: ReactNode;
  optional?: boolean;
  htmlFor?: string;
  className?: string;
}

export function FormLabel({
  children,
  icon,
  optional,
  htmlFor,
  className,
}: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-[12px] font-medium text-foreground/70 flex items-center gap-1.5",
        className
      )}
    >
      {icon}
      {children}
      {optional && (
        <span className="text-muted-foreground/60 font-normal">(optional)</span>
      )}
    </label>
  );
}
