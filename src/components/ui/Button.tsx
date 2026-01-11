import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "glass"
    | "glass-scope"
    | "warning"
    | "scope";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const { settings } = useSettingsStore();
    const useLiquidGlass = settings.liquid_glass_enabled;

    // Standard variants (when liquid glass is disabled)
    const standardVariants: Record<string, string> = {
      default: "scope-solid shadow",
      destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
      outline:
        "border border-black/10 dark:border-white/10 bg-background shadow-sm hover:bg-black/5 dark:hover:bg-white/5",
      secondary:
        "bg-black/5 dark:bg-white/10 text-foreground/70 shadow-sm hover:bg-black/10 dark:hover:bg-white/15",
      ghost: "hover:bg-black/[0.06] dark:hover:bg-white/[0.10]",
      link: "text-primary underline-offset-4 hover:underline",
      warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
      scope: "scope-accent scope-accent-text",
      glass: "liquid-glass-button",
      "glass-scope": "liquid-glass-button-scope",
    };

    const variantStyles = !useLiquidGlass
      ? variant === "glass"
        ? standardVariants.secondary
        : variant === "glass-scope"
        ? standardVariants.default
        : variant
      : standardVariants[variant] || standardVariants.default;

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variantStyles,
          {
            "px-4 py-2 text-[13px]": size === "default",
            "h-7 rounded-md px-2.5 text-[12px]": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-7 w-7 p-1.5": size === "icon",
            "h-6 w-6 p-1": size === "icon-sm",
          },
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
