import { cn } from "../../../lib/utils";
import { Section } from "../../common";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DangerTabProps {
  scopeName: string;
  onDelete?: () => void;
}

export function DangerTab({ scopeName, onDelete }: DangerTabProps) {
  return (
    <div className="space-y-6">
      <Section
        title="Delete Scope"
        icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
      >
        <div className="space-y-3">
          <p className="text-[13px] text-foreground/70">
            Permanently delete <span className="font-medium">{scopeName}</span>{" "}
            and remove all associated projects from tracking. This action cannot
            be undone.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Project files on disk will not be affected.
          </p>
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium",
              "bg-red-500/10 text-red-500",
              "hover:bg-red-500/20 transition-colors"
            )}
          >
            <Trash2 className="h-4 w-4" />
            Delete Scope
          </button>
        </div>
      </Section>
    </div>
  );
}
