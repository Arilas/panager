/**
 * ConfirmDialog Component for Glide
 *
 * A confirmation dialog with variants for danger, warning, and info.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  maxWidth?: string;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: typeof AlertTriangle;
    color: string;
    buttonVariant: "glass-destructive" | "warning" | "glass-scope";
  }
> = {
  danger: {
    icon: AlertTriangle,
    color: "red",
    buttonVariant: "glass-destructive",
  },
  warning: {
    icon: AlertCircle,
    color: "amber",
    buttonVariant: "warning",
  },
  info: {
    icon: Info,
    color: "blue",
    buttonVariant: "glass-scope",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  maxWidth = "sm:max-w-[400px]",
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                config.color === "red" && "bg-red-500/10",
                config.color === "amber" && "bg-amber-500/10",
                config.color === "blue" && "bg-blue-500/10"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  config.color === "red" && "text-red-500",
                  config.color === "amber" && "text-amber-500",
                  config.color === "blue" && "text-blue-500"
                )}
              />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {children && <div className="py-4">{children}</div>}

        <DialogFooter>
          <Button variant="glass" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
