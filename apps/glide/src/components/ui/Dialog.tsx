/**
 * IDE Dialog Component
 *
 * A copy of the base app's Dialog component that uses IDE settings context
 * instead of the main app settings store.
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
    useLiquidGlass?: boolean;
  }
>(({ className, useLiquidGlass, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50",
      useLiquidGlass ? "bg-transparent" : "bg-black/40 backdrop-blur-xs",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const liquidGlass = useLiquidGlass();

  return (
    <DialogPortal>
      <DialogOverlay useLiquidGlass={liquidGlass} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden",
          liquidGlass
            ? "liquid-glass-dialog liquid-glass-animate gap-4 p-6"
            : [
                "gap-4 p-6 shadow-xl",
                "rounded-xl",
                "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
                "border border-black/10 dark:border-white/10",
              ],
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute z-50 transition-all",
            liquidGlass
              ? [
                  "left-5 top-5 w-3.5 h-3.5 rounded-full",
                  "bg-[#FF5F57] hover:bg-[#FF5F57]",
                  "shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]",
                  "flex items-center justify-center",
                  "group",
                ]
              : [
                  "top-4 right-4 p-1 rounded-md",
                  "opacity-70 hover:opacity-100",
                  "hover:bg-black/5 dark:hover:bg-white/10",
                ],
            "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none"
          )}
        >
          <X
            className={cn(
              liquidGlass
                ? "h-2 w-2 text-[#4D0000] opacity-0 group-hover:opacity-100 transition-opacity stroke-[2.5]"
                : "h-4 w-4"
            )}
          />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const liquidGlass = useLiquidGlass();

  return (
    <div
      className={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        liquidGlass && "pl-6 -mt-2",
        className
      )}
      {...props}
    />
  );
};
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[15px] font-semibold text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
