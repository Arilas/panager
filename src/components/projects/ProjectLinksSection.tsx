import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import * as api from "../../lib/tauri";
import { useProjectsStore } from "../../stores/projects";
import { getProjectLinks } from "../../lib/tauri";
import { LINK_TYPES, detectLinkType } from "../../types";
import type { ProjectLink, LinkType, ProjectWithStatus } from "../../types";
import {
  Plus,
  Trash2,
  ExternalLink,
  Github,
  Link as LinkIcon,
} from "lucide-react";
import {
  JiraIcon,
  GitLabIcon,
  BitbucketIcon,
  ConfluenceIcon,
  NotionIcon,
  LinearIcon,
  SlackIcon,
} from "../icons/ServiceIcons";

interface ProjectLinksSectionProps {
  project: ProjectWithStatus;
  compact?: boolean;
}

export function ProjectLinksSection({
  project,
  compact,
}: ProjectLinksSectionProps) {
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [typeOverride, setTypeOverride] = useState<LinkType | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { createProjectLink, deleteProjectLink } = useProjectsStore();
  const [links, setLinks] = useState<ProjectLink[]>(project.links || []);

  // Load links when component mounts or project changes
  useEffect(() => {
    if (project) {
      // Use the links from the project prop, or fetch if not available
      if (project.links && project.links.length > 0) {
        setLinks(project.links);
      } else {
        // Fetch links if not in project prop
        api
          .getProjectLinks(project.project.id)
          .then(setLinks)
          .catch(console.error);
      }
    }
  }, [project.project.id, project.links]);

  // Scroll form into view when it appears
  useEffect(() => {
    if (adding && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [adding]);

  // Auto-detect type from URL, use override if set
  const detectedType = detectLinkType(newLink.url);
  const linkType = typeOverride ?? detectedType;
  const typeInfo = LINK_TYPES.find((t) => t.id === linkType);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.label.trim() || !newLink.url.trim()) return;

    setLoading(true);
    try {
      await createProjectLink({
        projectId: project.project.id,
        linkType,
        label: newLink.label.trim(),
        url: newLink.url.trim(),
      });
      const updatedLinks = await getProjectLinks(project.project.id);
      setLinks(updatedLinks);
      setNewLink({ label: "", url: "" });
      setTypeOverride(null);
      setShowTypeSelector(false);
      setAdding(false);
    } catch (error) {
      console.error("Failed to add link:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteProjectLink(linkId);
      // Refresh links
      const { getProjectLinks } = await import("../../lib/tauri");
      const updatedLinks = await getProjectLinks(project.project.id);
      setLinks(updatedLinks);
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* Existing Links */}
      <div className="space-y-2 w-full">
        {links.length === 0 && !adding ? (
          <div
            className={cn(
              "text-center text-[13px] text-muted-foreground",
              compact ? "py-4" : "py-8"
            )}
          >
            No links added yet
          </div>
        ) : (
          links.map((link) => (
            <LinkItem
              key={link.id}
              link={link}
              onDelete={() => handleDeleteLink(link.id)}
              compact={compact}
            />
          ))
        )}
      </div>

      {/* Add New Link Form */}
      {adding ? (
        <form
          ref={formRef}
          onSubmit={handleAddLink}
          className="space-y-3 p-3 rounded-lg border border-black/10 dark:border-white/10"
        >
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground/70">
              URL
            </label>
            <Input
              value={newLink.url}
              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              placeholder="https://github.com/..."
              type="url"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground/70">
              Label
            </label>
            <Input
              value={newLink.label}
              onChange={(e) =>
                setNewLink({ ...newLink, label: e.target.value })
              }
              placeholder="e.g., Main Repo"
            />
          </div>

          {/* Auto-detected type with override option */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Type:</span>
            {showTypeSelector ? (
              <div className="flex flex-wrap gap-1">
                {LINK_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setTypeOverride(type.id as LinkType);
                      setShowTypeSelector(false);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] transition-colors",
                      linkType === type.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTypeSelector(true)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]",
                  "bg-black/5 dark:bg-white/10",
                  "hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
                )}
              >
                {getLinkIcon(linkType)}
                <span>{typeInfo?.label || "Custom"}</span>
                {typeOverride && (
                  <span className="text-muted-foreground">(override)</span>
                )}
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewLink({ label: "", url: "" });
                setTypeOverride(null);
                setShowTypeSelector(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newLink.label.trim() || !newLink.url.trim()}
              loading={loading}
              variant="glass-scope"
            >
              {loading ? "Adding..." : "Add Link"}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg",
            "border border-dashed border-black/10 dark:border-white/10",
            "text-[13px] text-muted-foreground",
            "hover:border-primary/50 hover:text-primary transition-colors",
            compact ? "py-2" : "py-2.5"
          )}
        >
          <Plus className="h-4 w-4" />
          Add Link
        </button>
      )}
    </div>
  );
}

function getLinkIcon(linkType: string) {
  switch (linkType) {
    case "github":
      return <Github className="h-4 w-4" />;
    case "gitlab":
      return <GitLabIcon className="h-4 w-4" />;
    case "bitbucket":
      return <BitbucketIcon className="h-4 w-4" />;
    case "jira":
      return <JiraIcon className="h-4 w-4" />;
    case "confluence":
      return <ConfluenceIcon className="h-4 w-4" />;
    case "notion":
      return <NotionIcon className="h-4 w-4" />;
    case "linear":
      return <LinearIcon className="h-4 w-4" />;
    case "slack":
      return <SlackIcon className="h-4 w-4" />;
    default:
      return <LinkIcon className="h-4 w-4" />;
  }
}

function LinkItem({
  link,
  onDelete,
  compact,
}: {
  link: ProjectLink;
  onDelete: () => void;
  compact?: boolean;
}) {
  const typeInfo = LINK_TYPES.find((t) => t.id === link.linkType);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg w-full",
        "bg-black/[0.02] dark:bg-white/[0.02]",
        "border border-black/5 dark:border-white/5",
        "group",
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      )}
    >
      <div
        className={cn(
          "rounded-md bg-black/5 dark:bg-white/10 flex items-center justify-center text-foreground/60 shrink-0",
          compact ? "h-7 w-7" : "h-8 w-8"
        )}
      >
        {getLinkIcon(link.linkType)}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{link.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground/70 shrink-0">
            {typeInfo?.label || "Custom"}
          </span>
        </div>
        <p
          className="w-full text-[11px] text-muted-foreground truncate cursor-pointer hover:text-primary"
          onClick={() => window.open(link.url, "_blank")}
          title={link.url}
        >
          {link.url}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "p-1.5 rounded-md",
            "hover:bg-black/5 dark:hover:bg-white/10",
            "transition-colors"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            "p-1.5 rounded-md",
            "hover:bg-red-500/10 text-red-500",
            "transition-colors"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
