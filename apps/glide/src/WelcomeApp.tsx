/**
 * Welcome Window Root Component
 *
 * Lightweight standalone window for project selection.
 * Does not load IDE infrastructure (Monaco, LSP, file watchers, etc.)
 */

import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { windowWillClose } from "./lib/tauri-ide";

export function WelcomeApp() {
  // Handle window close - notify backend this is a welcome window closing
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const windowLabel = currentWindow.label;

    const unlisten = currentWindow.onCloseRequested(async () => {
      // Welcome window closing - hasProject=false means allow app to exit
      // if this is the last window
      await windowWillClose(windowLabel, false).catch(console.error);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return <WelcomeScreen />;
}
