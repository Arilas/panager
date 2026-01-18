import { useState, useCallback } from "react";
import { useProjectsStore } from "../../../stores/projects";
import type { ProjectCommand } from "../../../types";

export function useProjectCommands(projectId: string | undefined) {
  const [commands, setCommands] = useState<ProjectCommand[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [newCommand, setNewCommand] = useState({
    name: "",
    command: "",
    description: "",
    workingDirectory: "",
  });
  const [editingCommand, setEditingCommand] = useState<ProjectCommand | null>(
    null
  );
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);
  const [commandOutputs, setCommandOutputs] = useState<Record<string, string>>(
    {}
  );
  const [showCommandLog, setShowCommandLog] = useState<Record<string, boolean>>(
    {}
  );

  const {
    getProjectCommands,
    createProjectCommand,
    updateProjectCommand,
    deleteProjectCommand,
    executeProjectCommand,
  } = useProjectsStore();

  const loadCommands = useCallback(async () => {
    if (!projectId) return;

    setLoadingCommands(true);
    try {
      const cmds = await getProjectCommands(projectId);
      setCommands(cmds);
    } catch (error) {
      console.error("Failed to load commands:", error);
      setCommands([]);
    } finally {
      setLoadingCommands(false);
    }
  }, [projectId, getProjectCommands]);

  const handleAddCommand = useCallback(async () => {
    if (!projectId || !newCommand.name.trim() || !newCommand.command.trim())
      return;

    try {
      await createProjectCommand({
        projectId,
        name: newCommand.name.trim(),
        command: newCommand.command.trim(),
        description: newCommand.description.trim() || null,
        workingDirectory: newCommand.workingDirectory.trim() || null,
      });
      setNewCommand({
        name: "",
        command: "",
        description: "",
        workingDirectory: "",
      });
      await loadCommands();
    } catch (error) {
      console.error("Failed to add command:", error);
    }
  }, [projectId, newCommand, createProjectCommand, loadCommands]);

  const handleEditCommand = useCallback(async () => {
    if (!projectId || !editingCommand) return;

    try {
      await updateProjectCommand(
        editingCommand.id,
        editingCommand.name,
        editingCommand.command,
        editingCommand.description || undefined,
        editingCommand.workingDirectory || undefined
      );
      setEditingCommand(null);
      await loadCommands();
    } catch (error) {
      console.error("Failed to update command:", error);
    }
  }, [projectId, editingCommand, updateProjectCommand, loadCommands]);

  const handleDeleteCommand = useCallback(
    async (commandId: string) => {
      try {
        await deleteProjectCommand(commandId);
        await loadCommands();
      } catch (error) {
        console.error("Failed to delete command:", error);
      }
    },
    [deleteProjectCommand, loadCommands]
  );

  const handleExecuteCommand = useCallback(
    async (commandId: string, projectPath: string) => {
      setExecutingCommand(commandId);
      setCommandOutputs((prev) => ({ ...prev, [commandId]: "" }));
      setShowCommandLog((prev) => ({ ...prev, [commandId]: true }));
      try {
        const output = await executeProjectCommand(commandId, projectPath);
        setCommandOutputs((prev) => ({ ...prev, [commandId]: output }));
      } catch (error) {
        setCommandOutputs((prev) => ({ ...prev, [commandId]: String(error) }));
      } finally {
        setExecutingCommand(null);
      }
    },
    [executeProjectCommand]
  );

  const toggleCommandLog = useCallback((commandId: string) => {
    setShowCommandLog((prev) => ({
      ...prev,
      [commandId]: !prev[commandId],
    }));
  }, []);

  return {
    commands,
    loadingCommands,
    newCommand,
    setNewCommand,
    editingCommand,
    setEditingCommand,
    executingCommand,
    commandOutputs,
    showCommandLog,
    loadCommands,
    handleAddCommand,
    handleEditCommand,
    handleDeleteCommand,
    handleExecuteCommand,
    toggleCommandLog,
  };
}
