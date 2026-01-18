import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Input } from "../../ui/Input";
import { cn } from "../../../lib/utils";
import { useEditorsStore } from "../../../stores/editors";
import { useProjectsStore } from "../../../stores/projects";
import type { ProjectWithStatus } from "../../../types";

interface GeneralTabProps {
  project: ProjectWithStatus;
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  preferredEditorId: string;
  setPreferredEditorId: (editorId: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (groupId: string) => void;
}

export function GeneralTab({
  project,
  name,
  setName,
  description,
  setDescription,
  preferredEditorId,
  setPreferredEditorId,
  selectedGroupId,
  setSelectedGroupId,
}: GeneralTabProps) {
  const [copied, setCopied] = useState(false);
  const [projectGroups, setProjectGroups] = useState<
    Array<{ id: string; name: string; color: string | null }>
  >([]);

  const { editors } = useEditorsStore();
  const { getProjectGroups } = useProjectsStore();

  useEffect(() => {
    if (project.project.scopeId) {
      loadProjectGroups(project.project.scopeId);
    }
  }, [project.project.scopeId]);

  const loadProjectGroups = async (scopeId: string) => {
    try {
      const groups = await getProjectGroups(scopeId);
      setProjectGroups(groups);
    } catch (error) {
      console.error("Failed to load project groups:", error);
      setProjectGroups([]);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(project.project.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Project Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Project Path
        </label>
        <div className="flex gap-2">
          <Input
            value={project.project.path}
            readOnly
            className="flex-1 font-mono text-[12px]"
          />
          <button
            onClick={handleCopyPath}
            className={cn(
              "px-3 py-2 rounded-md transition-colors",
              "bg-black/5 dark:bg-white/10",
              "hover:bg-black/10 dark:hover:bg-white/15"
            )}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Description
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description or reminder..."
          maxLength={100}
        />
        <p className="text-[11px] text-muted-foreground">
          A brief description shown in the project list
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Default Editor
        </label>
        <select
          value={preferredEditorId}
          onChange={(e) => setPreferredEditorId(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-md text-[13px]",
            "bg-white dark:bg-white/5",
            "border border-black/10 dark:border-white/10",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        >
          <option value="">Use scope default</option>
          {editors
            .filter((e) => e.isAvailable)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Project Group
        </label>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-md text-[13px]",
            "bg-white dark:bg-white/5",
            "border border-black/10 dark:border-white/10",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        >
          <option value="">Ungrouped</option>
          {projectGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Organize this project into a group
        </p>
      </div>
    </div>
  );
}
