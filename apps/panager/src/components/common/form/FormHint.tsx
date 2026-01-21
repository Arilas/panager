import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface FormHintProps {
  children: ReactNode;
  className?: string;
}

export function FormHint({ children, className }: FormHintProps) {
  return (
    <p className={cn("text-[11px] text-muted-foreground", className)}>
      {children}
    </p>
  );
}
