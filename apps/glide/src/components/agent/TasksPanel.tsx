/**
 * Tasks Panel - Displays agent plan and task progress
 *
 * Shows the current agent plan with task statuses and progress.
 */

import { Circle, CheckCircle2, Loader2, XCircle, MinusCircle } from "lucide-react";
import { useAgentStore } from "../../stores/agent";
import { useEffectiveTheme } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { TaskStatus } from "../../types/acp";

const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  skipped: MinusCircle,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "text-neutral-400",
  in_progress: "text-blue-500 animate-spin",
  completed: "text-green-500",
  failed: "text-red-500",
  skipped: "text-neutral-400",
};

export function TasksPanel() {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  const currentPlan = useAgentStore((s) => s.currentPlan);
  const mode = useAgentStore((s) => s.mode);

  const tasks = currentPlan?.tasks || [];

  // Calculate progress
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 shrink-0",
          "border-b border-black/5 dark:border-white/5"
        )}
      >
        <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-neutral-900")}>
          Tasks
        </span>
        {totalCount > 0 && (
          <span className={cn("text-xs", isDark ? "text-neutral-400" : "text-neutral-500")}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="px-3 py-2 border-b border-black/5 dark:border-white/5">
          <div className={cn("h-1.5 rounded-full", isDark ? "bg-white/10" : "bg-black/10")}>
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className={cn("text-sm", isDark ? "text-neutral-400" : "text-neutral-500")}>
              {mode === "plan" ? "No plan created yet" : "No tasks in progress"}
            </p>
            <p className={cn("text-xs mt-1", isDark ? "text-neutral-500" : "text-neutral-400")}>
              {mode === "plan"
                ? "Start a conversation to generate a plan"
                : "Tasks will appear when Claude is working"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {tasks.map((task, index) => {
              const StatusIcon = STATUS_ICONS[task.status];
              const statusColor = STATUS_COLORS[task.status];

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg",
                    task.status === "in_progress" &&
                      (isDark ? "bg-white/5" : "bg-black/5")
                  )}
                >
                  {/* Status icon */}
                  <StatusIcon className={cn("w-4 h-4 mt-0.5 shrink-0", statusColor)} />

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        task.status === "completed" && "line-through opacity-60",
                        task.status === "skipped" && "line-through opacity-60",
                        isDark ? "text-white" : "text-neutral-900"
                      )}
                    >
                      {task.content}
                    </p>
                    {task.priority !== undefined && (
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-neutral-500" : "text-neutral-400"
                        )}
                      >
                        Priority: {task.priority}
                      </span>
                    )}
                  </div>

                  {/* Task number */}
                  <span
                    className={cn(
                      "text-xs tabular-nums shrink-0",
                      isDark ? "text-neutral-500" : "text-neutral-400"
                    )}
                  >
                    #{index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
