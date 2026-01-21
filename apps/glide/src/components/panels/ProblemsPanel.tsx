/**
 * Problems Panel - Displays diagnostics from plugins
 *
 * Shows errors, warnings, and other diagnostics grouped by file.
 * Clicking a diagnostic navigates to the file and line.
 */

import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  FileCode,
} from "lucide-react";
import { useProblemsStore } from "../../stores/problems";
import { useFilesStore } from "../../stores/files";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { Diagnostic, DiagnosticSeverity } from "../../types/problems";

export function ProblemsPanel() {
  // Subscribe to both the map and getAllDiagnostics to ensure reactivity
  const diagnosticsByFile = useProblemsStore((s) => s.diagnosticsByFile);
  const getAllDiagnostics = useProblemsStore((s) => s.getAllDiagnostics);
  const getSummary = useProblemsStore((s) => s.getSummary);
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  // Call getSummary() to get current values - recomputed on each render
  const summary = getSummary();
  // Also call getAllDiagnostics to force reactivity on the diagnostics list
  const allDiags = getAllDiagnostics();

  // Convert Map to array for rendering
  // Using allDiags.length as dependency ensures we re-compute when diagnostics change
  const groupedDiagnostics = useMemo(() => {
    const groups: Array<{ filePath: string; diagnostics: Diagnostic[] }> = [];
    for (const [filePath, diagnostics] of diagnosticsByFile) {
      groups.push({ filePath, diagnostics });
    }
    // Sort by file path
    return groups.sort((a, b) => a.filePath.localeCompare(b.filePath));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticsByFile, allDiags.length]);

  if (summary.total === 0) {
    return (
      <div
        className={cn(
          "h-full flex items-center justify-center",
          isDark ? "text-neutral-500" : "text-neutral-400"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 opacity-30" />
          <p className="text-sm">No problems detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary header */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 text-xs shrink-0",
          "border-b border-black/5 dark:border-white/5",
          isDark ? "text-neutral-400" : "text-neutral-500"
        )}
      >
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          {summary.errors} {summary.errors === 1 ? "error" : "errors"}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
          {summary.warnings} {summary.warnings === 1 ? "warning" : "warnings"}
        </span>
      </div>

      {/* Diagnostics list */}
      <div className="flex-1 overflow-y-auto">
        {groupedDiagnostics.map(({ filePath, diagnostics }) => (
          <DiagnosticGroup
            key={filePath}
            filePath={filePath}
            diagnostics={diagnostics}
          />
        ))}
      </div>
    </div>
  );
}

interface DiagnosticGroupProps {
  filePath: string;
  diagnostics: Diagnostic[];
}

function DiagnosticGroup({ filePath, diagnostics }: DiagnosticGroupProps) {
  const openFile = useFilesStore((s) => s.openFile);
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  // Get just the filename from the path
  const fileName = filePath.split("/").pop() || filePath;

  // Count by severity
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning"
  ).length;

  return (
    <div className="border-b border-black/5 dark:border-white/5">
      {/* File header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5",
          isDark ? "bg-neutral-800/30" : "bg-neutral-100/50"
        )}
      >
        <FileCode
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        />
        <span
          className={cn(
            "text-xs font-medium truncate",
            isDark ? "text-neutral-200" : "text-neutral-700"
          )}
        >
          {fileName}
        </span>
        <span
          className={cn(
            "text-[10px] truncate",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        >
          {filePath}
        </span>
        <div className="flex-1" />
        {errorCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-500">
            {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-500">
            {warningCount}
          </span>
        )}
      </div>

      {/* Diagnostics list */}
      <div>
        {diagnostics.map((diagnostic) => (
          <DiagnosticItem
            key={diagnostic.id}
            diagnostic={diagnostic}
            onNavigate={() => {
              // Open file and go to line
              openFile(filePath);
              // TODO: Navigate to specific line in editor
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface DiagnosticItemProps {
  diagnostic: Diagnostic;
  onNavigate: () => void;
}

function DiagnosticItem({ diagnostic, onNavigate }: DiagnosticItemProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const { icon: Icon, color } = getSeverityConfig(diagnostic.severity);

  return (
    <button
      onClick={onNavigate}
      className={cn(
        "w-full flex items-start gap-2 px-3 py-1.5 text-left",
        "hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", color)} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs leading-relaxed",
            isDark ? "text-neutral-200" : "text-neutral-700"
          )}
        >
          {diagnostic.message}
        </p>
        <p
          className={cn(
            "text-[10px] mt-0.5",
            isDark ? "text-neutral-500" : "text-neutral-400"
          )}
        >
          <span>{diagnostic.source}</span>
          {diagnostic.code && (
            <>
              <span className="mx-1">·</span>
              <span>{diagnostic.code}</span>
            </>
          )}
          <span className="mx-1">·</span>
          <span>
            Ln {diagnostic.startLine}, Col {diagnostic.startColumn}
          </span>
        </p>
      </div>
    </button>
  );
}

function getSeverityConfig(severity: DiagnosticSeverity): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
} {
  switch (severity) {
    case "error":
      return { icon: AlertCircle, color: "text-red-500" };
    case "warning":
      return { icon: AlertTriangle, color: "text-yellow-500" };
    case "information":
      return { icon: Info, color: "text-blue-500" };
    case "hint":
      return { icon: Lightbulb, color: "text-green-500" };
  }
}
