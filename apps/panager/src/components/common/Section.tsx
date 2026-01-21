import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function Section({ title, subtitle, icon, children }: SectionProps) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-[13px] font-medium">{title}</h3>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}
