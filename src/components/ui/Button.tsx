import * as React from "react";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass" | "glass-scope";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const { settings } = useSettingsStore();
    const useLiquidGlass = settings.liquid_glass_enabled;

    // Map glass variants to regular variants when liquid glass is disabled
    const effectiveVariant = !useLiquidGlass
      ? variant === "glass"
        ? "secondary"
        : variant === "glass-scope"
          ? "default"
          : variant
      : variant;

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground shadow hover:bg-primary/90":
              effectiveVariant === "default",
            "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90":
              effectiveVariant === "destructive",
            "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground":
              effectiveVariant === "outline",
            "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80":
              effectiveVariant === "secondary",
            "hover:bg-accent hover:text-accent-foreground": effectiveVariant === "ghost",
            "text-primary underline-offset-4 hover:underline": effectiveVariant === "link",
            // Liquid Glass variants
            "liquid-glass-button text-foreground/90": effectiveVariant === "glass",
            "liquid-glass-button-scope text-foreground/90": effectiveVariant === "glass-scope",
          },
          {
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
