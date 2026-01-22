import { cn } from "../../lib/utils";

interface ShortcutRowProps {
  label: string;
  shortcut: string;
}

export function ShortcutRow({ label, shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-foreground/80">{label}</span>
      <kbd
        className={cn(
          "px-2 py-1 rounded-md text-[12px] font-mono",
          "bg-black/5 dark:bg-white/10",
          "border border-black/10 dark:border-white/10"
        )}
      >
        {shortcut}
      </kbd>
    </div>
  );
}

export function formatHotkey(hotkey: string): string {
  return hotkey
    .replace("CmdOrCtrl", "\u2318")
    .replace("Shift", "\u21E7")
    .replace("+", "");
}
