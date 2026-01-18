/**
 * Main IDE Layout Component
 *
 * Structure:
 * ┌─────────────────────────────────────────────────────┐
 * │ ActivityBar │ Sidebar (resizable) │ Content Area    │
 * │             │                     │                 │
 * │  [Files]    │ FileTree / Git /    │ EditorTabs      │
 * │  [Git]      │ Search panels       │ MonacoEditor    │
 * │  [Search]   │                     │                 │
 * │             │                     │                 │
 * │             │                     │                 │
 * │  [Settings] │                     │                 │
 * ├─────────────┴─────────────────────┴─────────────────┤
 * │ StatusBar                                           │
 * └─────────────────────────────────────────────────────┘
 */

import { useIdeStore } from "../../stores/ide";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { ContentArea } from "./ContentArea";
import { StatusBar } from "./StatusBar";
import { QuickOpenDialog } from "../dialogs/QuickOpenDialog";
import { GoToLineDialog } from "../dialogs/GoToLineDialog";
import { useIdeKeyboard } from "../../hooks/useIdeKeyboard";

export function IdeLayout() {
  const sidebarCollapsed = useIdeStore((s) => s.sidebarCollapsed);
  const activePanel = useIdeStore((s) => s.activePanel);

  // Set up keyboard shortcuts
  useIdeKeyboard();

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-900 text-neutral-100 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar */}
        {activePanel && !sidebarCollapsed && <Sidebar />}

        {/* Content Area */}
        <ContentArea />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <QuickOpenDialog />
      <GoToLineDialog />
    </div>
  );
}
