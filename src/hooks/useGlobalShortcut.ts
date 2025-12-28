import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useGlobalShortcut() {
  useEffect(() => {
    const shortcut = "CommandOrControl+Shift+O";

    const registerShortcut = async () => {
      try {
        await register(shortcut, async () => {
          const window = getCurrentWindow();
          await window.show();
          await window.unminimize();
          await window.setFocus();
        });
        console.log(`Global shortcut ${shortcut} registered`);
      } catch (error) {
        console.error("Failed to register global shortcut:", error);
      }
    };

    registerShortcut();

    return () => {
      unregister(shortcut).catch(console.error);
    };
  }, []);
}
