import type { TempProjectOptions } from "../../../types";
import { OptionToggle } from "./OptionToggle";
import { OptionSelect } from "./OptionSelect";

// Extract types from TempProjectOptions
type NextjsOptions = NonNullable<TempProjectOptions["nextjs"]>;
type AstroOptions = NonNullable<TempProjectOptions["astro"]>;
type SveltekitOptions = NonNullable<TempProjectOptions["sveltekit"]>;
type SolidOptions = NonNullable<TempProjectOptions["solid"]>;
type NestOptions = NonNullable<TempProjectOptions["nest"]>;
type RemixOptions = NonNullable<TempProjectOptions["remix"]>;

interface AdvancedOptionsProps {
  template: string;
  options: TempProjectOptions;
  setOptions: (options: TempProjectOptions) => void;
}

// Default values for each framework
const NEXTJS_DEFAULTS: NextjsOptions = {
  typescript: true,
  tailwind: true,
  eslint: true,
  srcDir: true,
  router: "app",
};

const ASTRO_DEFAULTS: AstroOptions = {
  template: "basics",
  typescript: "strict",
};

const SVELTEKIT_DEFAULTS: SveltekitOptions = {
  typescript: true,
  eslint: true,
  prettier: true,
  playwright: false,
  vitest: false,
};

const SOLID_DEFAULTS: SolidOptions = { ssr: false };
const NEST_DEFAULTS: NestOptions = { strict: true };
const REMIX_DEFAULTS: RemixOptions = { typescript: true };

export function AdvancedOptions({
  template,
  options,
  setOptions,
}: AdvancedOptionsProps) {
  switch (template) {
    case "nextjs":
      return (
        <NextjsOptionsComponent
          options={{ ...NEXTJS_DEFAULTS, ...options.nextjs }}
          setOptions={(nextjs) => setOptions({ ...options, nextjs })}
        />
      );

    case "astro":
      return (
        <AstroOptionsComponent
          options={{ ...ASTRO_DEFAULTS, ...options.astro }}
          setOptions={(astro) => setOptions({ ...options, astro })}
        />
      );

    case "sveltekit":
      return (
        <SveltekitOptionsComponent
          options={{ ...SVELTEKIT_DEFAULTS, ...options.sveltekit }}
          setOptions={(sveltekit) => setOptions({ ...options, sveltekit })}
        />
      );

    case "solid":
      return (
        <SolidOptionsComponent
          options={{ ...SOLID_DEFAULTS, ...options.solid }}
          setOptions={(solid) => setOptions({ ...options, solid })}
        />
      );

    case "nest":
      return (
        <NestOptionsComponent
          options={{ ...NEST_DEFAULTS, ...options.nest }}
          setOptions={(nest) => setOptions({ ...options, nest })}
        />
      );

    case "remix":
      return (
        <RemixOptionsComponent
          options={{ ...REMIX_DEFAULTS, ...options.remix }}
          setOptions={(remix) => setOptions({ ...options, remix })}
        />
      );

    default:
      return (
        <p className="text-[12px] text-muted-foreground">
          No additional options available for this template.
        </p>
      );
  }
}

// Next.js Options
function NextjsOptionsComponent({
  options,
  setOptions,
}: {
  options: NextjsOptions;
  setOptions: (options: NextjsOptions) => void;
}) {
  const update = (patch: Partial<NextjsOptions>) =>
    setOptions({ ...options, ...patch });

  return (
    <div className="space-y-3">
      <OptionToggle
        label="TypeScript"
        checked={options.typescript}
        onChange={(v) => update({ typescript: v })}
      />
      <OptionToggle
        label="Tailwind CSS"
        checked={options.tailwind}
        onChange={(v) => update({ tailwind: v })}
      />
      <OptionToggle
        label="ESLint"
        checked={options.eslint}
        onChange={(v) => update({ eslint: v })}
      />
      <OptionSelect
        label="Router"
        value={options.router}
        onChange={(v) => update({ router: v as "app" | "pages" })}
        options={[
          { value: "app", label: "App Router" },
          { value: "pages", label: "Pages Router" },
        ]}
      />
    </div>
  );
}

// Astro Options
function AstroOptionsComponent({
  options,
  setOptions,
}: {
  options: AstroOptions;
  setOptions: (options: AstroOptions) => void;
}) {
  const update = (patch: Partial<AstroOptions>) =>
    setOptions({ ...options, ...patch });

  return (
    <div className="space-y-3">
      <OptionSelect
        label="Template"
        value={options.template}
        onChange={(v) =>
          update({ template: v as "basics" | "blog" | "minimal" })
        }
        options={[
          { value: "basics", label: "Basics" },
          { value: "blog", label: "Blog" },
          { value: "minimal", label: "Minimal" },
        ]}
      />
      <OptionSelect
        label="TypeScript"
        value={options.typescript}
        onChange={(v) =>
          update({ typescript: v as "strict" | "strictest" | "relaxed" })
        }
        options={[
          { value: "strict", label: "Strict" },
          { value: "strictest", label: "Strictest" },
          { value: "relaxed", label: "Relaxed" },
        ]}
      />
    </div>
  );
}

// SvelteKit Options
function SveltekitOptionsComponent({
  options,
  setOptions,
}: {
  options: SveltekitOptions;
  setOptions: (options: SveltekitOptions) => void;
}) {
  const update = (patch: Partial<SveltekitOptions>) =>
    setOptions({ ...options, ...patch });

  return (
    <div className="space-y-3">
      <OptionToggle
        label="TypeScript"
        checked={options.typescript}
        onChange={(v) => update({ typescript: v })}
      />
      <OptionToggle
        label="ESLint"
        checked={options.eslint}
        onChange={(v) => update({ eslint: v })}
      />
      <OptionToggle
        label="Prettier"
        checked={options.prettier}
        onChange={(v) => update({ prettier: v })}
      />
      <OptionToggle
        label="Vitest"
        checked={options.vitest}
        onChange={(v) => update({ vitest: v })}
      />
    </div>
  );
}

// Solid Options
function SolidOptionsComponent({
  options,
  setOptions,
}: {
  options: SolidOptions;
  setOptions: (options: SolidOptions) => void;
}) {
  return (
    <div className="space-y-3">
      <OptionToggle
        label="SSR (Server-Side Rendering)"
        checked={options.ssr}
        onChange={(v) => setOptions({ ssr: v })}
      />
    </div>
  );
}

// Nest Options
function NestOptionsComponent({
  options,
  setOptions,
}: {
  options: NestOptions;
  setOptions: (options: NestOptions) => void;
}) {
  return (
    <div className="space-y-3">
      <OptionToggle
        label="Strict Mode"
        checked={options.strict}
        onChange={(v) => setOptions({ strict: v })}
      />
    </div>
  );
}

// Remix Options
function RemixOptionsComponent({
  options,
  setOptions,
}: {
  options: RemixOptions;
  setOptions: (options: RemixOptions) => void;
}) {
  return (
    <div className="space-y-3">
      <OptionToggle
        label="TypeScript"
        checked={options.typescript}
        onChange={(v) => setOptions({ typescript: v })}
      />
    </div>
  );
}
