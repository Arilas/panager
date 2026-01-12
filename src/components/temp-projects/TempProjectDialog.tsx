import { useState, useEffect, useRef } from "react";
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
  checkTempFolderExists,
  onTempProjectProgress,
} from "../../lib/tauri";
import type {
  ScopeWithLinks,
  PackageManager,
  TempProjectRequest,
  TempProjectProgress,
  TempProjectOptions,
  JsonValue,
} from "../../types";
import {
  Package,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface TempProjectDialogProps {
  scope: ScopeWithLinks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string) => void;
}

const PACKAGE_MANAGERS: { id: PackageManager; label: string }[] = [
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
  {
    id: "vite-svelte-ts",
    label: "Vite + Svelte + TypeScript",
    category: "Vite",
  },
  { id: "vite-svelte", label: "Vite + Svelte", category: "Vite" },
  {
    id: "vite-vanilla-ts",
    label: "Vite + Vanilla + TypeScript",
    category: "Vite",
  },
  { id: "vite-vanilla", label: "Vite + Vanilla", category: "Vite" },
  { id: "nextjs", label: "Next.js", category: "Frameworks", hasOptions: true },
  { id: "remix", label: "Remix", category: "Frameworks", hasOptions: true },
  { id: "astro", label: "Astro", category: "Frameworks", hasOptions: true },
  { id: "nuxt", label: "Nuxt", category: "Frameworks" },
  {
    id: "sveltekit",
    label: "SvelteKit",
    category: "Frameworks",
    hasOptions: true,
  },
  {
    id: "solid",
    label: "SolidStart",
    category: "Frameworks",
    hasOptions: true,
  },
  { id: "nest", label: "NestJS", category: "Backend", hasOptions: true },
  { id: "hono", label: "Hono", category: "Backend" },
];

type CreationStatus = "idle" | "creating" | "success" | "error";

export function TempProjectDialog({
  scope,
  open,
  onOpenChange,
  onCreated,
}: TempProjectDialogProps) {
  const defaultFolder = scope.scope.defaultFolder;
  const tempSettings = scope.scope.tempProjectSettings;

  const [name, setName] = useState("");
  const [packageManager, setPackageManager] = useState<PackageManager>(
    (tempSettings?.preferredPackageManager as PackageManager) ?? "npm"
  );
  const [template, setTemplate] = useState("vite-react-ts");
  const [status, setStatus] = useState<CreationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [folderConflict, setFolderConflict] = useState(false);
  const [logLines, setLogLines] = useState<TempProjectProgress[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options state
  const [options, setOptions] = useState<TempProjectOptions>({});

  const logRef = useRef<HTMLDivElement>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setPackageManager(
        (tempSettings?.preferredPackageManager as PackageManager) ?? "npm"
      );
      setTemplate("vite-react-ts");
      setStatus("idle");
      setError(null);
      setFolderConflict(false);
      setLogLines([]);
      setShowLog(false);
      setShowAdvanced(false);
      setOptions({});
    }
  }, [open, tempSettings?.preferredPackageManager]);

  // Check for folder conflicts (debounced)
  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!name.trim() || !defaultFolder) {
      setFolderConflict(false);
      return;
    }

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const exists = await checkTempFolderExists(scope.scope.id, name.trim());
        setFolderConflict(exists);
      } catch (err) {
        console.error("Failed to check folder:", err);
      }
    }, 300);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [name, defaultFolder, scope.scope.id]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !defaultFolder || folderConflict) return;

    setStatus("creating");
    setError(null);
    setLogLines([]);
    setShowLog(true);

    // Subscribe to progress events
    const unlisten = await onTempProjectProgress((progress) => {
      setLogLines((prev) => [...prev, progress]);
    });

    try {
      const request: TempProjectRequest = {
        scopeId: scope.scope.id,
        name: name.trim(),
        packageManager,
        template,
        options:
          Object.keys(options).length > 0
            ? (options as unknown as JsonValue)
            : null,
      };

      const result = await createTempProject(request);

      if (result.success && result.projectId) {
        setStatus("success");
        onCreated?.(result.projectId);
        // Don't auto-close - let user read the output
      } else {
        setStatus("error");
        setError(result.error || "Failed to create project");
      }
    } catch (err) {
      setStatus("error");
      setError(String(err));
    } finally {
      unlisten();
    }
  };

  const groupedTemplates = TEMPLATES.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, typeof TEMPLATES>);

  const selectedTemplate = TEMPLATES.find((t) => t.id === template);
  const isCreating = status === "creating";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <Dialog open={open} onOpenChange={isCreating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : isError ? (
              <X className="h-5 w-5 text-red-500" />
            ) : (
              <Package className="h-5 w-5" />
            )}
            {isSuccess
              ? "Project Created"
              : isError
              ? "Creation Failed"
              : "New Temp Project"}
          </DialogTitle>
          <DialogDescription>
            {isCreating || isSuccess || isError ? (
              <span className="font-mono text-[11px]">
                {defaultFolder}/{name}
              </span>
            ) : (
              <>
                Create in scope folder:{" "}
                <span className="font-mono text-[11px]">{defaultFolder}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name - always visible, disabled when creating */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground/70">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project"
              autoFocus
              disabled={isCreating || isSuccess}
              className={cn(
                folderConflict && "border-red-500/50 focus:ring-red-500/30"
              )}
            />
            {folderConflict && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-500">
                <AlertCircle className="h-3 w-3" />A folder with this name
                already exists
              </div>
            )}
          </div>

          {/* Hide form fields when creating, show log */}
          {!isCreating && !isSuccess && !isError && (
            <>
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
                  {Object.entries(groupedTemplates).map(
                    ([category, templates]) => (
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
                    )
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              {selectedTemplate?.hasOptions && (
                <div className="border-t border-black/5 dark:border-white/5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdvanced ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Advanced options
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      <AdvancedOptions
                        template={template}
                        options={options}
                        setOptions={setOptions}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Log Output - shown during creation */}
          {(isCreating || isSuccess || isError) && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showLog ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Output ({logLines.length} lines)
              </button>
              {showLog && (
                <div
                  ref={logRef}
                  className={cn(
                    "h-[200px] overflow-y-auto rounded-lg p-3",
                    "bg-black/[0.02] dark:bg-white/[0.02]",
                    "border border-black/10 dark:border-white/10",
                    "font-mono text-[11px] leading-relaxed"
                  )}
                >
                  {logLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        line.isError ? "text-red-500" : "text-foreground/70"
                      )}
                    >
                      {line.line}
                    </div>
                  ))}
                  {isCreating && logLines.length === 0 && (
                    <div className="text-muted-foreground">Starting...</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && !showLog && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[12px]">
              {error}
            </div>
          )}

          <DialogFooter className="pt-4">
            {!isSuccess && (
              <Button
                variant="glass"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
            )}
            {isSuccess ? (
              <Button variant="glass-scope" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            ) : isError ? (
              <Button variant="glass-scope" onClick={() => setStatus("idle")}>
                Try Again
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!name.trim() || folderConflict}
                loading={isCreating}
                variant="glass-scope"
              >
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Advanced Options Component
interface AdvancedOptionsProps {
  template: string;
  options: TempProjectOptions;
  setOptions: (options: TempProjectOptions) => void;
}

function AdvancedOptions({
  template,
  options,
  setOptions,
}: AdvancedOptionsProps) {
  switch (template) {
    case "nextjs":
      return (
        <div className="space-y-3">
          <OptionToggle
            label="TypeScript"
            checked={options.nextjs?.typescript ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                nextjs: {
                  ...options.nextjs,
                  typescript: v,
                  router: options.nextjs?.router ?? "app",
                  tailwind: options.nextjs?.tailwind ?? true,
                  eslint: options.nextjs?.eslint ?? true,
                  srcDir: options.nextjs?.srcDir ?? true,
                },
              })
            }
          />
          <OptionToggle
            label="Tailwind CSS"
            checked={options.nextjs?.tailwind ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                nextjs: {
                  ...options.nextjs,
                  tailwind: v,
                  router: options.nextjs?.router ?? "app",
                  typescript: options.nextjs?.typescript ?? true,
                  eslint: options.nextjs?.eslint ?? true,
                  srcDir: options.nextjs?.srcDir ?? true,
                },
              })
            }
          />
          <OptionToggle
            label="ESLint"
            checked={options.nextjs?.eslint ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                nextjs: {
                  ...options.nextjs,
                  eslint: v,
                  router: options.nextjs?.router ?? "app",
                  typescript: options.nextjs?.typescript ?? true,
                  tailwind: options.nextjs?.tailwind ?? true,
                  srcDir: options.nextjs?.srcDir ?? true,
                },
              })
            }
          />
          <OptionSelect
            label="Router"
            value={options.nextjs?.router ?? "app"}
            onChange={(v) =>
              setOptions({
                ...options,
                nextjs: {
                  ...options.nextjs,
                  router: v as "app" | "pages",
                  typescript: options.nextjs?.typescript ?? true,
                  tailwind: options.nextjs?.tailwind ?? true,
                  eslint: options.nextjs?.eslint ?? true,
                  srcDir: options.nextjs?.srcDir ?? true,
                },
              })
            }
            options={[
              { value: "app", label: "App Router" },
              { value: "pages", label: "Pages Router" },
            ]}
          />
        </div>
      );

    case "astro":
      return (
        <div className="space-y-3">
          <OptionSelect
            label="Template"
            value={options.astro?.template ?? "basics"}
            onChange={(v) =>
              setOptions({
                ...options,
                astro: {
                  template: v as "basics" | "blog" | "minimal",
                  typescript: options.astro?.typescript ?? "strict",
                },
              })
            }
            options={[
              { value: "basics", label: "Basics" },
              { value: "blog", label: "Blog" },
              { value: "minimal", label: "Minimal" },
            ]}
          />
          <OptionSelect
            label="TypeScript"
            value={options.astro?.typescript ?? "strict"}
            onChange={(v) =>
              setOptions({
                ...options,
                astro: {
                  typescript: v as "strict" | "strictest" | "relaxed",
                  template: options.astro?.template ?? "basics",
                },
              })
            }
            options={[
              { value: "strict", label: "Strict" },
              { value: "strictest", label: "Strictest" },
              { value: "relaxed", label: "Relaxed" },
            ]}
          />
        </div>
      );

    case "sveltekit":
      return (
        <div className="space-y-3">
          <OptionToggle
            label="TypeScript"
            checked={options.sveltekit?.typescript ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                sveltekit: {
                  ...options.sveltekit,
                  typescript: v,
                  eslint: options.sveltekit?.eslint ?? true,
                  prettier: options.sveltekit?.prettier ?? true,
                  playwright: options.sveltekit?.playwright ?? false,
                  vitest: options.sveltekit?.vitest ?? false,
                },
              })
            }
          />
          <OptionToggle
            label="ESLint"
            checked={options.sveltekit?.eslint ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                sveltekit: {
                  ...options.sveltekit,
                  eslint: v,
                  typescript: options.sveltekit?.typescript ?? true,
                  prettier: options.sveltekit?.prettier ?? true,
                  playwright: options.sveltekit?.playwright ?? false,
                  vitest: options.sveltekit?.vitest ?? false,
                },
              })
            }
          />
          <OptionToggle
            label="Prettier"
            checked={options.sveltekit?.prettier ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                sveltekit: {
                  ...options.sveltekit,
                  prettier: v,
                  typescript: options.sveltekit?.typescript ?? true,
                  eslint: options.sveltekit?.eslint ?? true,
                  playwright: options.sveltekit?.playwright ?? false,
                  vitest: options.sveltekit?.vitest ?? false,
                },
              })
            }
          />
          <OptionToggle
            label="Vitest"
            checked={options.sveltekit?.vitest ?? false}
            onChange={(v) =>
              setOptions({
                ...options,
                sveltekit: {
                  ...options.sveltekit,
                  vitest: v,
                  typescript: options.sveltekit?.typescript ?? true,
                  eslint: options.sveltekit?.eslint ?? true,
                  prettier: options.sveltekit?.prettier ?? true,
                  playwright: options.sveltekit?.playwright ?? false,
                },
              })
            }
          />
        </div>
      );

    case "solid":
      return (
        <div className="space-y-3">
          <OptionToggle
            label="SSR (Server-Side Rendering)"
            checked={options.solid?.ssr ?? false}
            onChange={(v) =>
              setOptions({
                ...options,
                solid: { ssr: v },
              })
            }
          />
        </div>
      );

    case "nest":
      return (
        <div className="space-y-3">
          <OptionToggle
            label="Strict Mode"
            checked={options.nest?.strict ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                nest: { strict: v },
              })
            }
          />
        </div>
      );

    case "remix":
      return (
        <div className="space-y-3">
          <OptionToggle
            label="TypeScript"
            checked={options.remix?.typescript ?? true}
            onChange={(v) =>
              setOptions({
                ...options,
                remix: { typescript: v },
              })
            }
          />
        </div>
      );

    default:
      return (
        <p className="text-[12px] text-muted-foreground">
          No additional options available for this template.
        </p>
      );
  }
}

// Helper components for options
function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full"
    >
      <span className="text-[12px]">{label}</span>
      <div
        className={cn(
          "w-8 h-5 rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-black/20 dark:bg-white/20"
        )}
      >
        <div
          className={cn(
            "w-4 h-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-3" : "translate-x-0"
          )}
        />
      </div>
    </button>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "px-2 py-1 rounded text-[11px]",
          "bg-white dark:bg-white/10",
          "border border-black/10 dark:border-white/10",
          "focus:outline-none focus:ring-1 focus:ring-primary/50"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
