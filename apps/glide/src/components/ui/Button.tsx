/**
 * Button Component for Glide
 *
 * Button with loading state support and liquid glass variants.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "secondary"
    | "ghost"
    | "link"
    | "glass"
    | "glass-scope"
    | "glass-destructive"
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
    ref,
  ) => {
    const liquidGlass = useLiquidGlass();

    // Standard variants (when liquid glass is disabled)
    const standardVariants: Record<string, string> = {
      default:
        "bg-[var(--accent-color,#3b82f6)] text-white shadow-sm hover:brightness-90",
      destructive: "bg-red-500 text-white shadow-xs hover:bg-red-600",
      secondary:
        "bg-black/5 dark:bg-white/10 text-foreground/70 shadow-xs hover:bg-black/10 dark:hover:bg-white/15",
      ghost: "hover:bg-black/6 dark:hover:bg-white/10",
      link: "text-primary underline-offset-4 hover:underline",
      warning: "bg-amber-500 text-white shadow-xs hover:bg-amber-600",
      scope:
        "bg-[color-mix(in_srgb,var(--accent-color,#3b82f6)_15%,transparent)] text-[var(--accent-color,#3b82f6)]",
      glass: "liquid-glass-button",
      "glass-scope": "liquid-glass-button-scope",
      "glass-destructive": "liquid-glass-button-destructive",
    };

    // When liquid glass is disabled, map glass variants to standard equivalents
    const variantStyles = !liquidGlass
      ? variant === "glass"
        ? standardVariants.secondary
        : variant === "glass-scope"
          ? standardVariants.default
          : variant === "glass-destructive"
            ? standardVariants.destructive
            : standardVariants[variant] || standardVariants.default
      : standardVariants[variant] || standardVariants.default;

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variantStyles,
          {
            "px-4 py-2 text-[13px]": size === "default",
            "h-7 rounded-md px-2.5 text-[12px]": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-7 w-7 p-1.5": size === "icon",
            "h-6 w-6 p-1": size === "icon-sm",
          },
          className,
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
