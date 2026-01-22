/**
 * Welcome Screen Component
 *
 * Shown when Glide is launched without a project path.
 * Displays recent projects and provides an "Open Folder" button.
 */

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Sparkles, Folder, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useAppearanceSettings } from "../stores/settings";
import { useEffectiveTheme } from "../hooks/useEffectiveTheme";
import md5 from "../lib/md5";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  getRecentProjects,
  removeRecentProject,
  openIdeWindow,
  hideWindow,
  type RecentProject,
} from "../lib/tauri-ide";

// Note: WelcomeScreen no longer uses onProjectSelected callback.
// Instead, it calls openIdeWindow directly and closes itself.

/**
 * Format relative time (e.g., "2 days ago", "Just now")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    const diffMonths = Math.floor(diffDays / 30);
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  }
  if (diffDays > 0) {
    return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffMinutes > 0) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }
  return "Just now";
}

export function WelcomeScreen() {
  const [loading, setLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const appearance = useAppearanceSettings();
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  // Compute liquid glass enabled (auto mode checks macOS 26+)
  const useLiquidGlass =
    appearance.liquidGlassMode === "auto"
      ? typeof CSS !== "undefined" &&
        CSS.supports("-apple-visual-effect", "-apple-system-glass-material")
      : appearance.liquidGlassMode;

  // Load recent projects on mount
  useEffect(() => {
    getRecentProjects()
      .then(setRecentProjects)
      .catch((e) => console.error("Failed to load recent projects:", e))
      .finally(() => setLoadingRecent(false));
  }, []);

  const handleOpenFolder = async () => {
    setLoading(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });

      if (selected && typeof selected === "string") {
        // Extract folder name from path
        const pathParts = selected.split(/[/\\]/);
        const projectName = pathParts[pathParts.length - 1] || "Untitled";

        // Generate project ID from path hash
        const projectId = md5(selected);

        // Check if project is already open in another window
        const createdNew = await openIdeWindow(projectId, selected, projectName);

        // Hide/close this welcome window (uses pool-aware hideWindow)
        const windowLabel = getCurrentWindow().label;
        await hideWindow(windowLabel).catch(() => {
          // Fallback to close() if hideWindow fails
          getCurrentWindow().close();
        });

        // Log whether a new window was created or existing was focused
        if (!createdNew) {
          console.log("Focused existing window for project");
        }
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (project: RecentProject) => {
    // Check if project is already open in another window
    const createdNew = await openIdeWindow(project.id, project.path, project.name);

    // Hide/close this welcome window (uses pool-aware hideWindow)
    const windowLabel = getCurrentWindow().label;
    await hideWindow(windowLabel).catch(() => {
      // Fallback to close() if hideWindow fails
      getCurrentWindow().close();
    });

    // Log whether a new window was created or existing was focused
    if (!createdNew) {
      console.log("Focused existing window for project:", project.name);
    }
  };

  const handleRemoveRecent = async (
    e: React.MouseEvent,
    project: RecentProject,
  ) => {
    e.stopPropagation();
    try {
      await removeRecentProject(project.path);
      setRecentProjects((prev) => prev.filter((p) => p.path !== project.path));
    } catch (error) {
      console.error("Failed to remove recent project:", error);
    }
  };

  return (
    <div
      className={cn(
        "h-screen w-screen flex flex-col",
        isDark ? "bg-neutral-900/60" : "bg-white/60",
      )}
    >
      {/* Titlebar area for drag */}
      <div
        className={cn(
          "titlebar titlebar-compact flex items-center justify-center",
          useLiquidGlass ? "liquid-glass-titlebar" : "",
        )}
        data-tauri-drag-region
      >
        <span
          className={cn(
            "text-sm font-medium",
            isDark ? "text-white/70" : "text-black/70",
          )}
        >
          Glide
        </span>
      </div>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center overflow-auto",
        )}
      >
        <div className="flex flex-col items-center gap-6 max-w-2xl w-full text-center px-8 py-12">
          {/* Logo/Icon */}
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center",
              useLiquidGlass
                ? "liquid-glass-card"
                : isDark
                  ? "bg-neutral-800"
                  : "bg-neutral-100",
            )}
          >
            <Sparkles
              className={cn(
                "w-8 h-8",
                isDark ? "text-blue-400" : "text-blue-500",
              )}
            />
          </div>

          {/* Welcome text */}
          <div className="space-y-1">
            <h1
              className={cn(
                "text-xl font-semibold",
                isDark ? "text-white" : "text-neutral-900",
              )}
            >
              Welcome to Glide
            </h1>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-neutral-400" : "text-neutral-500",
              )}
            >
              AI-powered code editor with agent mode
            </p>
          </div>

          {/* Open Folder button */}
          <button
            onClick={handleOpenFolder}
            disabled={loading}
            className={cn(
              "flex items-center gap-3 px-5 py-2.5 rounded-lg font-medium transition-all text-sm",
              useLiquidGlass
                ? "liquid-glass-button-scope"
                : [
                    "bg-blue-500 text-white",
                    "hover:bg-blue-600",
                    "disabled:opacity-50",
                  ],
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span>Open Folder</span>
          </button>

          {/* Recent Projects Section */}
          {!loadingRecent && recentProjects.length > 0 && (
            <div className="w-full mt-4">
              <h2
                className={cn(
                  "text-xs font-medium uppercase tracking-wider mb-3 text-left",
                  isDark ? "text-neutral-500" : "text-neutral-400",
                )}
              >
                Recent Projects
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {recentProjects.map((project) => (
                  <button
                    key={project.path}
                    onClick={() => handleOpenRecent(project)}
                    className={cn(
                      "group relative flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                      useLiquidGlass
                        ? "liquid-glass-card hover:liquid-glass-card-hover"
                        : isDark
                          ? "bg-neutral-800/50 hover:bg-neutral-800"
                          : "bg-neutral-100/50 hover:bg-neutral-100",
                    )}
                  >
                    {/* Folder icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        isDark ? "bg-neutral-700/50" : "bg-neutral-200/50",
                      )}
                    >
                      <Folder
                        className={cn(
                          "w-5 h-5",
                          isDark ? "text-blue-400" : "text-blue-500",
                        )}
                      />
                    </div>

                    {/* Project info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "font-medium text-sm truncate",
                          isDark ? "text-white" : "text-neutral-900",
                        )}
                      >
                        {project.name}
                      </div>
                      <div
                        className={cn(
                          "text-xs truncate mt-0.5",
                          isDark ? "text-neutral-500" : "text-neutral-400",
                        )}
                      >
                        {formatRelativeTime(project.lastOpened)}
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => handleRemoveRecent(e, project)}
                      className={cn(
                        "absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                        isDark
                          ? "hover:bg-neutral-600/50 text-neutral-400"
                          : "hover:bg-neutral-300/50 text-neutral-500",
                      )}
                      title="Remove from recent"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard shortcut hint */}
          <p
            className={cn(
              "text-xs mt-4",
              isDark ? "text-neutral-500" : "text-neutral-400",
            )}
          >
            Or drag and drop a folder onto this window
          </p>
        </div>
      </div>
    </div>
  );
}
