import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { AlertCircle } from "lucide-react";

interface FormErrorProps {
  children: ReactNode;
  className?: string;
}

export function FormError({ children, className }: FormErrorProps) {
  return (
    <p
      className={cn(
        "text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1",
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      {children}
    </p>
  );
}
