import { useState } from "react";
import { cn } from "../../../lib/utils";

interface NotesTabProps {
  notes: string;
  setNotes: (notes: string) => void;
}

export function NotesTab({ notes, setNotes }: NotesTabProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-medium text-foreground/70">
          Project Notes
        </label>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={cn(
            "text-[11px] px-2 py-1 rounded",
            "bg-black/5 dark:bg-white/10",
            "hover:bg-black/10 dark:hover:bg-white/15",
            "transition-colors"
          )}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div
          className={cn(
            "min-h-[300px] p-3 rounded-md",
            "bg-black/5 dark:bg-white/5",
            "text-[13px] whitespace-pre-wrap"
          )}
        >
          {notes || (
            <span className="text-muted-foreground italic">No notes yet</span>
          )}
        </div>
      ) : (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add markdown notes, reminders, links to docs, issues, etc..."
          className={cn(
            "w-full min-h-[300px] px-3 py-2 rounded-md text-[13px]",
            "bg-white dark:bg-white/5",
            "border border-black/10 dark:border-white/10",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "font-mono resize-none"
          )}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Markdown supported. Notes are shown in the project list (truncated).
      </p>
    </div>
  );
}
