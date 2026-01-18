import type { ReactElement } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Severity } from "../../types";

export interface SeverityConfig {
  icon: typeof AlertCircle;
  borderStyle: string;
  iconStyle: string;
  textColor: string;
  badgeStyle: string;
  bgColor: string;
  hoverColor: string;
  solidColor: string;
}

export const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  error: {
    icon: AlertCircle,
    borderStyle: "border-red-500/20",
    iconStyle: "bg-red-500/10 text-red-600 dark:text-red-400",
    textColor: "text-red-600 dark:text-red-400",
    badgeStyle: "bg-red-500/10 text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
    hoverColor: "hover:bg-red-500/20",
    solidColor: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    borderStyle: "border-amber-500/20",
    iconStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    hoverColor: "hover:bg-amber-500/20",
    solidColor: "bg-amber-500",
  },
  info: {
    icon: Info,
    borderStyle: "border-blue-500/20",
    iconStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    hoverColor: "hover:bg-blue-500/20",
    solidColor: "bg-blue-500",
  },
};

export function getSeverityConfig(severity: Severity): SeverityConfig {
  return SEVERITY_CONFIG[severity];
}

interface SeverityIconProps {
  severity: Severity;
  className?: string;
}

export function SeverityIcon({
  severity,
  className,
}: SeverityIconProps): ReactElement {
  const Icon = getSeverityConfig(severity).icon;
  return <Icon className={className} />;
}

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({
  severity,
  className,
}: SeverityBadgeProps): ReactElement {
  const config = getSeverityConfig(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        config.badgeStyle,
        className
      )}
    >
      <SeverityIcon severity={severity} className="h-2.5 w-2.5" />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
