/**
 * Content Area - Editor tabs and content
 *
 * Container for the editor groups (supporting split views).
 * Uses the new tabs store and EditorGroups component.
 */

import { useEffectiveTheme, useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { EditorGroups } from "../editor/EditorGroups";
import { cn } from "../../lib/utils";

export function ContentArea() {
  const effectiveTheme = useEffectiveTheme();
  const liquidGlass = useLiquidGlass();

  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={cn(
        "flex-1 flex flex-col min-w-0",
        liquidGlass
          ? "liquid-glass-content"
          : isDark
            ? "bg-neutral-900/50"
            : "bg-white/50"
      )}
    >
      <EditorGroups />
    </div>
  );
}
