import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md px-3 py-1 text-[13px]",
          "bg-white/60 dark:bg-white/5",
          "border border-black/10 dark:border-white/10",
          "text-foreground placeholder:text-muted-foreground/50",
          "transition-colors",
          "focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
