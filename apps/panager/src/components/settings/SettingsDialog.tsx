import * as Tabs from "@radix-ui/react-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/Dialog";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";
import { TabTrigger } from "../common";
import {
  Sun,
  Code,
  Keyboard,
  Sparkles,
  Droplet,
  Activity,
  Terminal,
} from "lucide-react";
import {
  GeneralSettingsSection,
  AppearanceSettingsSection,
  EditorsSettingsSection,
  TerminalsSettingsSection,
  ShortcutsSettingsSection,
  DiagnosticsSettingsSection,
  MaxSettingsSection,
} from "./sections";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings } = useSettingsStore();
  const useLiquidGlass = settings.liquid_glass_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        {!useLiquidGlass && (
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
        )}
        <Tabs.Root defaultValue="general" className="flex h-[460px]">
          <Tabs.List
            className={cn(
              "flex flex-col w-[160px] shrink-0",
              useLiquidGlass
                ? "p-3 liquid-glass-sidebar gap-1 pt-10"
                : "p-2 pt-6 border-r border-black/5 dark:border-white/5"
            )}
          >
            <TabTrigger value="general" icon={<Sun className="h-4 w-4" />}>
              General
            </TabTrigger>
            <TabTrigger
              value="appearance"
              icon={<Droplet className="h-4 w-4" />}
            >
              Appearance
            </TabTrigger>
            <TabTrigger value="editors" icon={<Code className="h-4 w-4" />}>
              Editors
            </TabTrigger>
            <TabTrigger value="terminals" icon={<Terminal className="h-4 w-4" />}>
              Terminals
            </TabTrigger>
            <TabTrigger
              value="shortcuts"
              icon={<Keyboard className="h-4 w-4" />}
            >
              Shortcuts
            </TabTrigger>
            <TabTrigger
              value="diagnostics"
              icon={<Activity className="h-4 w-4" />}
            >
              Diagnostics
            </TabTrigger>
            <TabTrigger value="max" icon={<Sparkles className="h-4 w-4" />}>
              Max
            </TabTrigger>
          </Tabs.List>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {useLiquidGlass && (
                <DialogHeader className="px-6 pt-4 pb-2 shrink-0 sticky top-0 z-50 backdrop-blur-xs">
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
              )}
              <Tabs.Content value="general" className="px-6 pt-2 pb-6">
                <GeneralSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="appearance" className="px-6 pt-2 pb-6">
                <AppearanceSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="editors" className="px-6 pt-2 pb-6">
                <EditorsSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="terminals" className="px-6 pt-2 pb-6">
                <TerminalsSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="shortcuts" className="px-6 pt-2 pb-6">
                <ShortcutsSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="diagnostics" className="px-6 pt-2 pb-6">
                <DiagnosticsSettingsSection />
              </Tabs.Content>
              <Tabs.Content value="max" className="px-6 pt-2 pb-6">
                <MaxSettingsSection />
              </Tabs.Content>
            </div>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
