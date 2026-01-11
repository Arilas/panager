import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  createTempProject,
  getTempProjectsPath,
  type TempProjectRequest,
} from "../../lib/tauri";
import { useProjectsStore } from "../../stores/projects";
import { useScopesStore } from "../../stores/scopes";
import { Package, Loader2 } from "lucide-react";

interface TempProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PACKAGE_MANAGERS = [
  { id: "npm", label: "npm" },
  { id: "yarn", label: "Yarn" },
  { id: "pnpm", label: "pnpm" },
  { id: "bun", label: "Bun" },
];

const TEMPLATES = [
  { id: "vite-react-ts", label: "Vite + React + TypeScript", category: "Vite" },
  { id: "vite-react", label: "Vite + React", category: "Vite" },
  { id: "vite-vue-ts", label: "Vite + Vue + TypeScript", category: "Vite" },
  { id: "vite-vue", label: "Vite + Vue", category: "Vite" },
  { id: "vite-svelte-ts", label: "Vite + Svelte + TypeScript", category: "Vite" },
  { id: "vite-svelte", label: "Vite + Svelte", category: "Vite" },
  { id: "vite-vanilla-ts", label: "Vite + Vanilla + TypeScript", category: "Vite" },
  { id: "vite-vanilla", label: "Vite + Vanilla", category: "Vite" },
  { id: "nextjs", label: "Next.js (App Router)", category: "Frameworks" },
  { id: "astro", label: "Astro", category: "Frameworks" },
  { id: "nuxt", label: "Nuxt", category: "Frameworks" },
  { id: "sveltekit", label: "SvelteKit", category: "Frameworks" },
];

export function TempProjectDialog({
  open,
  onOpenChange,
}: TempProjectDialogProps) {
  const [name, setName] = useState("");
  const [packageManager, setPackageManager] = useState("npm");
  const [template, setTemplate] = useState("vite-react-ts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPath, setTempPath] = useState("");

  const { createProject } = useProjectsStore();
  const { currentScopeId } = useScopesStore();

  useEffect(() => {
    if (open) {
      getTempProjectsPath().then(setTempPath).catch(console.error);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentScopeId) return;

    setLoading(true);
    setError(null);

    try {
      const request: TempProjectRequest = {
        name: name.trim(),
        packageManager,
        template,
      };

      const result = await createTempProject(request);

      if (result.success) {
        // Add the project to the current scope
        await createProject({
          scopeId: currentScopeId,
          name: name.trim(),
          path: result.path,
          isTemp: true,
        });

        setName("");
        onOpenChange(false);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const groupedTemplates = TEMPLATES.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<string, typeof TEMPLATES>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            New Temp Project
          </DialogTitle>
          <DialogDescription>
            Create a quick temporary project. It will be saved to:{" "}
            <span className="font-mono text-[11px]">
              {tempPath || "loading..."}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project"
              autoFocus
            />
          </div>

          {/* Package Manager */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Package Manager
            </label>
            <div className="flex gap-2">
              {PACKAGE_MANAGERS.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPackageManager(pm.id)}
                  className={cn(
                    "flex-1 py-2 rounded-md text-[13px] font-medium transition-colors",
                    packageManager === pm.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                  )}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Template
            </label>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
              {Object.entries(groupedTemplates).map(([category, templates]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide bg-black/[0.02] dark:bg-white/[0.02] sticky top-0">
                    {category}
                  </div>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-[13px] transition-colors",
                        template === t.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[12px]">
              {error}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              loading={loading}
            >
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
