/**
 * Editor Group Component
 *
 * A single editor group containing:
 * - Tab bar
 * - Breadcrumb
 * - Content (editor, diff, chat, etc.)
 *
 * Multiple groups can exist side-by-side for split view.
 */

import { useMemo, useEffect } from "react";
import { FileCode2, Loader2 } from "lucide-react";
import { useTabsStore } from "../../stores/tabs";
import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { Breadcrumb } from "./Breadcrumb";
import { EditorGroupTabs } from "./EditorGroupTabs";
import { cn } from "../../lib/utils";
import type { TabEntry, TabComponentProps } from "../../lib/tabs/types";

interface EditorGroupProps {
  groupId: string;
  isActive: boolean;
}

export function EditorGroup({ groupId, isActive }: EditorGroupProps) {
  const groups = useTabsStore((s) => s.groups);
  const registry = useTabsStore((s) => s.registry);
  const setActiveGroup = useTabsStore((s) => s.setActiveGroup);
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  const isDark = effectiveTheme === "dark";

  // Find this group
  const group = useMemo(() => {
    return groups.find((g) => g.id === groupId);
  }, [groups, groupId]);

  // Get active tab
  const activeTab = useMemo(() => {
    if (!group || !group.activeUrl) return null;
    return group.tabs.find((t) => t.url === group.activeUrl) ?? null;
  }, [group]);

  const hasTabs = group && group.tabs.length > 0;

  // Handle click to activate group
  const handleGroupClick = () => {
    if (!isActive) {
      setActiveGroup(groupId);
    }
  };

  // Get file path for breadcrumb
  const breadcrumbPath = useMemo(() => {
    if (!activeTab || !registry) return null;
    const resolver = registry.findResolver(activeTab.url);
    return resolver?.toFilePath?.(activeTab.url) ?? null;
  }, [activeTab, registry]);

  return (
    <div
      className={cn(
        "flex-1 flex flex-col min-w-0 min-h-0",
        liquidGlass
          ? "liquid-glass-content"
          : isDark
            ? "bg-neutral-900/50"
            : "bg-white/50",
        !isActive && "opacity-90"
      )}
      onClick={handleGroupClick}
    >
      {/* Tab bar */}
      {hasTabs && (
        <EditorGroupTabs groupId={groupId} isGroupActive={isActive} />
      )}

      {/* Breadcrumb */}
      {breadcrumbPath && <Breadcrumb path={breadcrumbPath} />}

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {activeTab ? (
          <TabContent
            tab={activeTab}
            groupId={groupId}
            isGroupActive={isActive}
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}

interface TabContentProps {
  tab: TabEntry;
  groupId: string;
  isGroupActive: boolean;
}

function TabContent({ tab, groupId, isGroupActive }: TabContentProps) {
  const registry = useTabsStore((s) => s.registry);
  const resolveTab = useTabsStore((s) => s.resolveTab);

  // Get resolver for this tab
  const resolver = useMemo(() => {
    if (!registry) return null;
    return registry.findResolver(tab.url);
  }, [registry, tab.url]);

  // Auto-resolve when tab is shown but not resolved
  useEffect(() => {
    if (!tab.resolved && !tab.error) {
      resolveTab(tab.url, groupId).catch(console.error);
    }
  }, [tab.url, tab.resolved, tab.error, groupId, resolveTab]);

  // Handle error state
  if (tab.error) {
    const ErrorComponent = resolver?.getErrorComponent();
    if (ErrorComponent) {
      return (
        <ErrorComponent
          url={tab.url}
          error={tab.error}
          onRetry={() => resolveTab(tab.url, groupId)}
        />
      );
    }
    return <ErrorFallback error={tab.error} onRetry={() => resolveTab(tab.url, groupId)} />;
  }

  // Handle lazy (unresolved) state
  if (!tab.resolved) {
    return <LoadingScreen />;
  }

  // Render resolved content
  if (!resolver) {
    return <ErrorFallback error="No resolver found" onRetry={() => resolveTab(tab.url, groupId)} />;
  }

  const Component = resolver.getComponent();
  const props: TabComponentProps = {
    url: tab.url,
    data: tab.resolved.data,
    groupId,
    isGroupActive,
  };

  return <Component {...props} />;
}

function LoadingScreen() {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <Loader2 className="w-8 h-8 animate-spin opacity-50" />
      <p className="text-sm mt-3">Loading...</p>
    </div>
  );
}

function WelcomeScreen() {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}
    >
      <FileCode2 className="w-16 h-16 mb-4 opacity-30" />
      <p className="text-lg font-medium">No file open</p>
      <p className="text-sm mt-1">
        Select a file from the explorer to view its contents
      </p>
      <div className="mt-6 text-xs space-y-1">
        <p>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded",
              isDark
                ? "bg-neutral-800 text-neutral-400"
                : "bg-neutral-200 text-neutral-600"
            )}
          >
            ⌘P
          </kbd>{" "}
          Quick Open
        </p>
        <p>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded",
              isDark
                ? "bg-neutral-800 text-neutral-400"
                : "bg-neutral-200 text-neutral-600"
            )}
          >
            ⌘⇧E
          </kbd>{" "}
          Explorer
        </p>
      </div>
    </div>
  );
}

interface ErrorFallbackProps {
  error: string;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center gap-4",
        isDark ? "text-neutral-300" : "text-neutral-600"
      )}
    >
      <p className="text-red-500">{error}</p>
      <button
        onClick={onRetry}
        className={cn(
          "px-4 py-2 rounded text-sm",
          isDark
            ? "bg-neutral-700 hover:bg-neutral-600"
            : "bg-neutral-200 hover:bg-neutral-300"
        )}
      >
        Retry
      </button>
    </div>
  );
}
