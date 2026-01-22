/**
 * IDE Tab Trigger Component
 *
 * A copy of the base app's TabTrigger that uses IDE settings context.
 */

import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";

interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
}

const dangerClasses =
  "text-red-500/70 hover:bg-red-500/5 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500";

export function TabTrigger({
  value,
  children,
  icon,
  variant = "default",
}: TabTriggerProps) {
  const liquidGlass = useLiquidGlass();

  const activeClasses =
    variant === "danger"
      ? dangerClasses
      : liquidGlass
        ? "data-[state=active]:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] data-[state=active]:text-(--accent-color)"
        : "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium";

  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "flex items-center gap-2 rounded-md text-left transition-colors",
        liquidGlass
          ? "px-3 py-1.5 text-[13px] font-medium"
          : "px-3 py-2 text-[13px]",
        variant === "default" && "text-foreground/70",
        variant === "default" && "hover:bg-black/5 dark:hover:bg-white/5",
        activeClasses,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </Tabs.Trigger>
  );
}
