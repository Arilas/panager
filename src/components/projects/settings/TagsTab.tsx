import { useState } from "react";
import { Tag, X, Plus } from "lucide-react";
import { Input } from "../../ui/Input";
import { cn } from "../../../lib/utils";
import { useProjectsStore } from "../../../stores/projects";

interface TagsTabProps {
  projectId: string;
  tags: string[];
}

export function TagsTab({ projectId, tags }: TagsTabProps) {
  const [newTag, setNewTag] = useState("");
  const { addTag, removeTag, getAllTags } = useProjectsStore();

  const allTags = getAllTags();
  const suggestedTags = allTags.filter(
    (t) =>
      !tags.includes(t) && t.toLowerCase().includes(newTag.toLowerCase())
  );

  const handleAddTag = async (tag: string) => {
    if (!tag.trim()) return;

    try {
      await addTag(projectId, tag.trim().toLowerCase());
      setNewTag("");
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await removeTag(projectId, tag);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-foreground/70">
          Current Tags
        </label>
        {tags.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-2">No tags yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px]",
                  "bg-primary/10 text-primary"
                )}
              >
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-0.5 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddTag(newTag);
        }}
        className="space-y-2"
      >
        <label className="text-[12px] font-medium text-foreground/70">
          Add Tag
        </label>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Enter tag name..."
            className="flex-1"
          />
          <button
            type="submit"
            disabled={!newTag.trim()}
            className={cn(
              "px-3 py-2 rounded-md",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      {suggestedTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-foreground/70">
            Suggestions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => handleAddTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px]",
                  "bg-black/5 dark:bg-white/10",
                  "hover:bg-black/10 dark:hover:bg-white/15",
                  "transition-colors"
                )}
              >
                <Plus className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
