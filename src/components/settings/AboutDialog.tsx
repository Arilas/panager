import {
  Dialog,
  DialogContent,
} from "../ui/Dialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px] p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/icon.png"
            alt="Panager"
            className="w-20 h-20 rounded-2xl shadow-lg"
          />

          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Panager</h2>
            <p className="text-[13px] text-muted-foreground">Version 0.1.0</p>
          </div>

          <p className="text-[12px] text-muted-foreground leading-relaxed">
            A cross-platform project manager for developers. Organize projects,
            track git status, and quickly open in your favorite editor.
          </p>

          <div className="pt-2 text-[11px] text-muted-foreground/70">
            Made with care by krona
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
