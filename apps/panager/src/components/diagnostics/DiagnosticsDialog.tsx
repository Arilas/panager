import type { ReactElement } from "react";
import { useState, useEffect, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { DiagnosticsIssueList } from "./DiagnosticsIssueList";
import { FixDiagnosticDialog } from "./FixDiagnosticDialog";
import { useDiagnosticsStore } from "../../stores/diagnostics";
import { useSettingsStore } from "../../stores/settings";
import { cn } from "../../lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  LayoutList,
  RefreshCw,
  List,
  EyeOff,
} from "lucide-react";
import type { DiagnosticIssue } from "../../types";

interface DiagnosticsDialogProps {
  scopeId: string;
  scopeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabId = "all" | "errors" | "warnings" | "info" | "dismissed";
type GroupBy = "severity" | "group" | "none";

export function DiagnosticsDialog({
  scopeId,
  scopeName,
  open,
  onOpenChange,
}: DiagnosticsDialogProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("severity");
  const [fixDialogIssue, setFixDialogIssue] = useState<DiagnosticIssue | null>(
    null
  );

  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  const {
    issues,
    summaries,
    fetchScopeDiagnostics,
    scanScope,
    isScopeScanning,
  } = useDiagnosticsStore();

  const scopeIssues = issues.get(scopeId) ?? [];
  const summary = summaries.get(scopeId);
  const isScanning = isScopeScanning(scopeId);

  useEffect(() => {
    if (open) {
      fetchScopeDiagnostics(scopeId, true);
    }
  }, [open, scopeId, fetchScopeDiagnostics]);

  const filteredIssues = useMemo(() => {
    return scopeIssues.filter((issue) => {
      if (activeTab === "dismissed") return issue.dismissed;
      if (issue.dismissed) return false;

      switch (activeTab) {
        case "errors":
          return issue.severity === "error";
        case "warnings":
          return issue.severity === "warning";
        case "info":
          return issue.severity === "info";
        default:
          return true;
      }
    });
  }, [scopeIssues, activeTab]);

  const dismissedCount = useMemo(
    () => scopeIssues.filter((i) => i.dismissed).length,
    [scopeIssues]
  );

  const tabs: Array<{
    id: TabId;
    label: string;
    count: number;
    icon: typeof AlertCircle;
  }> = [
    { id: "all", label: "All", count: summary?.totalCount ?? 0, icon: List },
    {
      id: "errors",
      label: "Errors",
      count: summary?.errorCount ?? 0,
      icon: AlertCircle,
    },
    {
      id: "warnings",
      label: "Warnings",
      count: summary?.warningCount ?? 0,
      icon: AlertTriangle,
    },
    { id: "info", label: "Info", count: summary?.infoCount ?? 0, icon: Info },
    { id: "dismissed", label: "Dismissed", count: dismissedCount, icon: EyeOff },
  ];

  async function handleScan(): Promise<void> {
    await scanScope(scopeId);
  }

  function handleFixIssue(issue: DiagnosticIssue): void {
    setFixDialogIssue(issue);
  }

  function handleFixDialogClose(isOpen: boolean): void {
    if (!isOpen) {
      setFixDialogIssue(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <Tabs.Root
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabId)}
            className="flex h-[460px]"
          >
            <Tabs.List
              className={cn(
                "flex flex-col w-[160px] shrink-0",
                useLiquidGlass
                  ? "p-3 pt-10 liquid-glass-sidebar gap-1"
                  : "p-2 pt-6 border-r border-black/5 dark:border-white/5"
              )}
            >
              {tabs.map((tab) => (
                <TabTrigger
                  key={tab.id}
                  value={tab.id}
                  icon={<tab.icon className="h-4 w-4" />}
                  count={tab.count}
                >
                  {tab.label}
                </TabTrigger>
              ))}
            </Tabs.List>

            <div className="flex-1 min-w-0 flex flex-col">
              {useLiquidGlass && (
                <DialogHeader className="px-6 pt-4 pb-2 shrink-0">
                  <DialogTitle>Diagnostics</DialogTitle>
                </DialogHeader>
              )}
              {!useLiquidGlass && (
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                  <DialogTitle>Diagnostics</DialogTitle>
                  <p className="text-[12px] text-muted-foreground">
                    Issues found in {scopeName}
                  </p>
                </DialogHeader>
              )}

              <div className="flex items-center justify-between px-6 py-2 border-b border-black/5 dark:border-white/5">
                <span className="text-[12px] text-muted-foreground">
                  {filteredIssues.length} issue
                  {filteredIssues.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", isScanning && "animate-spin")}
                    />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-black/5 dark:hover:bg-white/10"
                        title="Group by"
                      >
                        <LayoutList className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        value={groupBy}
                        onValueChange={(v) => setGroupBy(v as GroupBy)}
                      >
                        <DropdownMenuRadioItem value="severity">
                          Severity
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="group">
                          Group
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="none">
                          None
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <DiagnosticsIssueList
                  issues={filteredIssues}
                  groupBy={activeTab === "dismissed" ? "none" : groupBy}
                  showDismissed={activeTab === "dismissed"}
                  onFixIssue={handleFixIssue}
                />
              </div>

              {summary?.lastScanAt && (
                <div className="text-[10px] text-muted-foreground text-center py-2 border-t border-black/5 dark:border-white/5 shrink-0">
                  Last scanned {formatRelativeTime(summary.lastScanAt)}
                </div>
              )}
            </div>
          </Tabs.Root>
        </DialogContent>
      </Dialog>

      <FixDiagnosticDialog
        issue={fixDialogIssue}
        open={fixDialogIssue !== null}
        onOpenChange={handleFixDialogClose}
      />
    </>
  );
}

function TabTrigger({
  value,
  children,
  icon,
  count,
}: {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}) {
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  const baseStyles = cn(
    "flex items-center gap-2 px-3 text-[13px] rounded-md text-left",
    "text-foreground/70 transition-colors",
    "hover:bg-black/5 dark:hover:bg-white/5"
  );

  const activeStyles = useLiquidGlass
    ? "py-1.5 font-medium data-[state=active]:bg-[color-mix(in_srgb,var(--scope-color)_10%,transparent)] data-[state=active]:text-(--scope-color)"
    : "py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium";

  return (
    <Tabs.Trigger value={value} className={cn(baseStyles, activeStyles)}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
          {count}
        </span>
      )}
    </Tabs.Trigger>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}
