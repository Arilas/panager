import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { FormLabel } from "./FormLabel";
import { FormHint } from "./FormHint";
import { FormError } from "./FormError";

interface FormFieldProps {
  label: string;
  icon?: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  icon,
  optional,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <FormLabel icon={icon} optional={optional}>
        {label}
      </FormLabel>
      {children}
      {error ? <FormError>{error}</FormError> : hint && <FormHint>{hint}</FormHint>}
    </div>
  );
}
