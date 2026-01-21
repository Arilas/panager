import { Loader2, Settings2, Trash2, Terminal, Plus } from "lucide-react";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";
import type { ProjectCommand } from "../../../types";

interface CommandsTabProps {
  commands: ProjectCommand[];
  loading: boolean;
  newCommand: {
    name: string;
    command: string;
    description: string;
    workingDirectory: string;
  };
  setNewCommand: (cmd: {
    name: string;
    command: string;
    description: string;
    workingDirectory: string;
  }) => void;
  editingCommand: ProjectCommand | null;
  setEditingCommand: (cmd: ProjectCommand | null) => void;
  executingCommand: string | null;
  commandOutputs: Record<string, string>;
  showCommandLog: Record<string, boolean>;
  onAddCommand: () => void;
  onEditCommand: () => void;
  onDeleteCommand: (commandId: string) => void;
  onExecuteCommand: (commandId: string) => void;
  onToggleCommandLog: (commandId: string) => void;
}

export function CommandsTab({
  commands,
  loading,
  newCommand,
  setNewCommand,
  editingCommand,
  setEditingCommand,
  executingCommand,
  commandOutputs,
  showCommandLog,
  onAddCommand,
  onEditCommand,
  onDeleteCommand,
  onExecuteCommand,
  onToggleCommandLog,
}: CommandsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {commands.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-2">
            No commands yet
          </p>
        ) : (
          commands.map((cmd) => (
            <div
              key={cmd.id}
              className="p-3 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-[13px] font-medium">{cmd.name}</h4>
                  {cmd.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {cmd.description}
                    </p>
                  )}
                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                    {cmd.command}
                  </p>
                  {cmd.workingDirectory && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Working dir: {cmd.workingDirectory}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onExecuteCommand(cmd.id)}
                    disabled={executingCommand === cmd.id}
                    className={cn(
                      "px-2 py-1 rounded text-[11px]",
                      "bg-primary/10 text-primary hover:bg-primary/20",
                      "disabled:opacity-50"
                    )}
                  >
                    {executingCommand === cmd.id ? "Running..." : "Run"}
                  </button>
                  <button
                    onClick={() => setEditingCommand(cmd)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteCommand(cmd.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {commandOutputs[cmd.id] && (
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => onToggleCommandLog(cmd.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Terminal className="h-3 w-3" />
                    {showCommandLog[cmd.id] ? "Hide" : "Show"} output
                  </button>
                  {showCommandLog[cmd.id] && commandOutputs[cmd.id] && (
                    <div
                      className={cn(
                        "rounded-md bg-black/5 dark:bg-black/30 p-2",
                        "font-mono text-[10px] leading-relaxed",
                        "max-h-[200px] overflow-y-auto",
                        "text-muted-foreground whitespace-pre-wrap break-all"
                      )}
                    >
                      {commandOutputs[cmd.id]}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {editingCommand ? (
        <div className="p-3 rounded-lg border border-black/10 dark:border-white/10 space-y-3">
          <h4 className="text-[12px] font-medium">Edit Command</h4>
          <Input
            value={editingCommand.name}
            onChange={(e) =>
              setEditingCommand({ ...editingCommand, name: e.target.value })
            }
            placeholder="Command name"
          />
          <Input
            value={editingCommand.command}
            onChange={(e) =>
              setEditingCommand({ ...editingCommand, command: e.target.value })
            }
            placeholder="Command to run"
          />
          <Input
            value={editingCommand.description || ""}
            onChange={(e) =>
              setEditingCommand({
                ...editingCommand,
                description: e.target.value,
              })
            }
            placeholder="Description (optional)"
          />
          <Input
            value={editingCommand.workingDirectory || ""}
            onChange={(e) =>
              setEditingCommand({
                ...editingCommand,
                workingDirectory: e.target.value,
              })
            }
            placeholder="Working directory (optional, relative to project)"
          />
          <div className="flex gap-2">
            <Button
              variant="glass"
              size="sm"
              onClick={() => setEditingCommand(null)}
            >
              Cancel
            </Button>
            <Button variant="glass-scope" size="sm" onClick={onEditCommand}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-black/10 dark:border-white/10 space-y-3">
          <h4 className="text-[12px] font-medium">Add Command</h4>
          <Input
            value={newCommand.name}
            onChange={(e) =>
              setNewCommand({ ...newCommand, name: e.target.value })
            }
            placeholder="Command name"
          />
          <Input
            value={newCommand.command}
            onChange={(e) =>
              setNewCommand({ ...newCommand, command: e.target.value })
            }
            placeholder="Command to run (e.g., npm run build)"
          />
          <Input
            value={newCommand.description}
            onChange={(e) =>
              setNewCommand({ ...newCommand, description: e.target.value })
            }
            placeholder="Description (optional)"
          />
          <Input
            value={newCommand.workingDirectory}
            onChange={(e) =>
              setNewCommand({ ...newCommand, workingDirectory: e.target.value })
            }
            placeholder="Working directory (optional, relative to project)"
          />
          <Button
            variant="glass-scope"
            size="sm"
            onClick={onAddCommand}
            disabled={!newCommand.name.trim() || !newCommand.command.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Command
          </Button>
        </div>
      )}
    </div>
  );
}
