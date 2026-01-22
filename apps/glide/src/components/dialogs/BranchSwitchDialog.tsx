/**
 * Branch Switch Dialog
 *
 * Command palette-style dialog for switching branches with autocomplete,
 * new branch creation, and handling of uncommitted changes.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Command } from "cmdk";
import {
  GitBranch,
  Plus,
  Check,
  ArrowUp,
  ArrowDown,
  Archive,
  ArchiveX,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useIdeStore } from "../../stores/ide";
import { useGitStore } from "../../stores/git";
import { useLiquidGlass } from "../../hooks/useEffectiveTheme";
import { cn } from "../../lib/utils";
import type { GitLocalBranch } from "../../types";

interface BranchSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogMode = "select" | "confirm-clean" | "confirm-dirty" | "creating";

type SwitchOptionId =
  | "stash-checkout-pop"
  | "stash-checkout"
  | "reset-checkout"
  | "just-checkout"
  | "cancel";

interface SwitchOption {
  id: SwitchOptionId;
  label: string;
  description: string;
  icon: React.ReactNode;
  destructive?: boolean;
  hasInput?: boolean;
  inputPlaceholder?: string;
}

const SWITCH_OPTIONS: SwitchOption[] = [
  {
    id: "stash-checkout-pop",
    label: "Stash, Switch, and Pop",
    description: "Save your changes to stash, switch branch, then restore them",
    icon: <Archive className="h-4 w-4" />,
  },
  {
    id: "stash-checkout",
    label: "Stash and Switch",
    description: "Save your changes to a named stash and switch branch",
    icon: <ArchiveX className="h-4 w-4" />,
    hasInput: true,
    inputPlaceholder: "Stash name (optional)",
  },
  {
    id: "reset-checkout",
    label: "Discard Changes and Switch",
    description: "Permanently discard all uncommitted changes",
    icon: <Trash2 className="h-4 w-4" />,
    destructive: true,
  },
  {
    id: "just-checkout",
    label: "Switch Anyway",
    description: "Try to switch with your changes (may fail if conflicts)",
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    id: "cancel",
    label: "Cancel",
    description: "Go back without switching",
    icon: <X className="h-4 w-4" />,
  },
];

export function BranchSwitchDialog({
  open,
  onOpenChange,
}: BranchSwitchDialogProps) {
  const projectContext = useIdeStore((s) => s.projectContext);
  const useLiquidGlassEnabled = useLiquidGlass();

  const {
    branch,
    branches,
    branchesLoading,
    loadBranches,
    switchBranch,
    createBranch,
    checkUncommittedChanges,
    stashSave,
    stashPop,
    refresh,
  } = useGitStore();

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<DialogMode>("select");
  const [targetBranch, setTargetBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirtyOption, setSelectedDirtyOption] = useState<SwitchOptionId | null>(null);
  const [stashName, setStashName] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open && projectContext) {
      setSearch("");
      setMode("select");
      setTargetBranch(null);
      setSwitching(false);
      setError(null);
      setSelectedDirtyOption(null);
      setStashName("");
      loadBranches(projectContext.projectPath);
    }
  }, [open, projectContext, loadBranches]);

  // Filter branches based on search
  const filteredBranches = useMemo(() => {
    if (!search.trim()) return branches;
    const query = search.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(query));
  }, [branches, search]);

  // Check if search matches any existing branch exactly
  const exactMatch = useMemo(() => {
    return branches.some(
      (b) => b.name.toLowerCase() === search.toLowerCase().trim()
    );
  }, [branches, search]);

  // Can create new branch if search has text and doesn't match existing
  const canCreateBranch = search.trim().length > 0 && !exactMatch;

  const handleSelectBranch = useCallback(
    async (branchName: string) => {
      if (!projectContext || branchName === branch?.name) return;

      setTargetBranch(branchName);
      setError(null);

      // Check for uncommitted changes
      const hasChanges = await checkUncommittedChanges(
        projectContext.projectPath
      );

      if (hasChanges) {
        setMode("confirm-dirty");
      } else {
        setMode("confirm-clean");
      }
    },
    [projectContext, branch, checkUncommittedChanges]
  );

  const handleCreateBranch = useCallback(async () => {
    if (!projectContext || !search.trim()) return;

    const newBranchName = search.trim();
    setMode("creating");
    setSwitching(true);
    setError(null);

    try {
      await createBranch(projectContext.projectPath, newBranchName, undefined, true);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch");
      setMode("select");
    } finally {
      setSwitching(false);
    }
  }, [projectContext, search, createBranch, onOpenChange]);

  const handleConfirmClean = useCallback(async () => {
    if (!projectContext || !targetBranch) return;

    setSwitching(true);
    setError(null);

    try {
      await switchBranch(projectContext.projectPath, targetBranch);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch branch");
      setMode("select");
    } finally {
      setSwitching(false);
    }
  }, [projectContext, targetBranch, switchBranch, onOpenChange]);

  const handleDirtyOption = useCallback(
    async (optionId: SwitchOption["id"], inputValue?: string) => {
      if (!projectContext || !targetBranch) return;

      if (optionId === "cancel") {
        setMode("select");
        setTargetBranch(null);
        setSelectedDirtyOption(null);
        setStashName("");
        return;
      }

      setSwitching(true);
      setError(null);

      try {
        if (optionId === "stash-checkout-pop") {
          // Stash current changes
          await stashSave(
            projectContext.projectPath,
            `Auto-stash before switching to ${targetBranch}`
          );
          // Switch branch
          await switchBranch(projectContext.projectPath, targetBranch);
          // Pop stash
          await stashPop(projectContext.projectPath, 0);
        } else if (optionId === "stash-checkout") {
          // Stash current changes with custom name (don't pop)
          const stashMessage = inputValue?.trim() || `WIP on ${branch?.name} before switching to ${targetBranch}`;
          await stashSave(projectContext.projectPath, stashMessage);
          // Switch branch
          await switchBranch(projectContext.projectPath, targetBranch);
        } else if (optionId === "reset-checkout") {
          // Hard reset and switch - use git checkout -f to discard changes
          await switchBranch(projectContext.projectPath, targetBranch);
        } else if (optionId === "just-checkout") {
          // Just try to switch
          await switchBranch(projectContext.projectPath, targetBranch);
        }

        await refresh(projectContext.projectPath);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch branch");
        setMode("select");
      } finally {
        setSwitching(false);
      }
    },
    [projectContext, targetBranch, branch, stashSave, stashPop, switchBranch, refresh, onOpenChange]
  );

  const handleBack = useCallback(() => {
    setMode("select");
    setTargetBranch(null);
    setError(null);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Switch Branch"
      overlayClassName={
        useLiquidGlassEnabled
          ? "bg-transparent!"
          : "bg-black/40 backdrop-blur-xs"
      }
      className={cn(
        "fixed left-1/2 top-[15%] z-50 w-full max-w-[480px] -translate-x-1/2",
        "shadow-2xl overflow-hidden",
        useLiquidGlassEnabled
          ? "liquid-glass-command liquid-glass-animate"
          : [
              "rounded-xl",
              "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl",
              "border border-black/10 dark:border-white/10",
            ]
      )}
    >
      {/* Selection Mode */}
      {mode === "select" && (
        <>
          <div
            className={cn(
              "flex items-center px-4",
              useLiquidGlassEnabled
                ? "border-b border-white/10"
                : "border-b border-black/5 dark:border-white/5"
            )}
          >
            <GitBranch className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search or create branch..."
              className={cn(
                "flex-1 h-12 px-3 text-[14px] bg-transparent",
                "placeholder:text-muted-foreground/50",
                "focus:outline-hidden"
              )}
            />
            {branchesLoading && (
              <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
            )}
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          <Command.List
            className={cn(
              "max-h-[400px] overflow-y-auto",
              useLiquidGlassEnabled ? "p-1" : "p-2",
              "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5",
              "**:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium",
              "**:[[cmdk-group-heading]]:text-muted-foreground/60 **:[[cmdk-group-heading]]:uppercase",
              "**:[[cmdk-group-heading]]:tracking-wide"
            )}
          >
            <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/60">
              {branches.length === 0
                ? "No branches found."
                : "No matching branches."}
            </Command.Empty>

            {/* Create new branch option */}
            {canCreateBranch && (
              <Command.Group heading="Create">
                <Command.Item
                  value={`create new branch ${search}`}
                  onSelect={handleCreateBranch}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                    "text-[13px] text-foreground/90",
                    "aria-selected:bg-primary/10 aria-selected:text-primary",
                    "transition-colors"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Create branch{" "}
                    <span className="font-medium">{search.trim()}</span>
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Branches list */}
            {filteredBranches.length > 0 && (
              <Command.Group heading="Branches">
                {filteredBranches.map((b) => (
                  <BranchItem
                    key={b.name}
                    branch={b}
                    isCurrent={b.name === branch?.name}
                    onSelect={() => handleSelectBranch(b.name)}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>

          <DialogFooter useLiquidGlass={useLiquidGlassEnabled} />
        </>
      )}

      {/* Confirm Clean Switch */}
      {mode === "confirm-clean" && targetBranch && (
        <ConfirmDialog
          title="Switch Branch"
          message={
            <>
              Switch to <span className="font-medium">{targetBranch}</span>?
            </>
          }
          confirmLabel="Switch"
          onConfirm={handleConfirmClean}
          onCancel={handleBack}
          loading={switching}
          useLiquidGlass={useLiquidGlassEnabled}
        />
      )}

      {/* Confirm Dirty Switch - Show options */}
      {mode === "confirm-dirty" && targetBranch && (
        <DirtyConfirmDialog
          targetBranch={targetBranch}
          options={SWITCH_OPTIONS}
          selectedOption={selectedDirtyOption}
          onSelectOption={setSelectedDirtyOption}
          inputValue={stashName}
          onInputChange={setStashName}
          onConfirm={handleDirtyOption}
          loading={switching}
          error={error}
          useLiquidGlass={useLiquidGlassEnabled}
        />
      )}

      {/* Creating branch */}
      {mode === "creating" && (
        <div className="p-8 text-center">
          <div className="w-6 h-6 mx-auto border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">
            Creating branch <span className="font-medium">{search.trim()}</span>
            ...
          </p>
        </div>
      )}
    </Command.Dialog>
  );
}

interface BranchItemProps {
  branch: GitLocalBranch;
  isCurrent: boolean;
  onSelect: () => void;
}

function BranchItem({ branch, isCurrent, onSelect }: BranchItemProps) {
  return (
    <Command.Item
      value={`branch ${branch.name}`}
      onSelect={onSelect}
      disabled={isCurrent}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
        "text-[13px] text-foreground/90",
        "aria-selected:bg-primary/10 aria-selected:text-primary",
        "transition-colors",
        isCurrent && "opacity-50 cursor-default"
      )}
    >
      {isCurrent ? (
        <Check className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <GitBranch className="h-4 w-4 shrink-0" />
      )}
      <span className="flex-1 truncate">{branch.name}</span>

      {/* Ahead/behind indicators */}
      <div className="flex items-center gap-1 text-xs">
        {branch.ahead > 0 && (
          <span className="flex items-center text-green-500">
            <ArrowUp className="w-3 h-3" />
            {branch.ahead}
          </span>
        )}
        {branch.behind > 0 && (
          <span className="flex items-center text-orange-500">
            <ArrowDown className="w-3 h-3" />
            {branch.behind}
          </span>
        )}
      </div>
    </Command.Item>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  useLiquidGlass: boolean;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  useLiquidGlass,
}: ConfirmDialogProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <p className="text-[13px] text-muted-foreground mb-4">{message}</p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={loading}
          className={cn(
            "px-3 py-1.5 text-[13px] rounded-lg transition-colors",
            useLiquidGlass
              ? "bg-white/10 hover:bg-white/20"
              : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
          )}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "px-3 py-1.5 text-[13px] rounded-lg transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "flex items-center gap-2"
          )}
        >
          {loading && (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

interface DirtyConfirmDialogProps {
  targetBranch: string;
  options: SwitchOption[];
  selectedOption: SwitchOptionId | null;
  onSelectOption: (optionId: SwitchOptionId | null) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onConfirm: (optionId: SwitchOptionId, inputValue?: string) => void;
  loading: boolean;
  error: string | null;
  useLiquidGlass: boolean;
}

function DirtyConfirmDialog({
  targetBranch,
  options,
  selectedOption,
  onSelectOption,
  inputValue,
  onInputChange,
  onConfirm,
  loading,
  error,
  useLiquidGlass,
}: DirtyConfirmDialogProps) {
  const handleOptionClick = (option: SwitchOption) => {
    if (option.hasInput) {
      // Toggle selection for options with input
      onSelectOption(selectedOption === option.id ? null : option.id);
    } else {
      // Execute immediately for options without input
      onConfirm(option.id);
    }
  };

  const handleConfirmWithInput = () => {
    if (selectedOption) {
      onConfirm(selectedOption, inputValue);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "px-4 py-3",
          useLiquidGlass
            ? "border-b border-white/10"
            : "border-b border-black/5 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-2 text-yellow-500 mb-1">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Uncommitted Changes</span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          You have uncommitted changes. Choose how to proceed when switching to{" "}
          <span className="font-medium">{targetBranch}</span>.
        </p>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      <div className="p-2">
        {options.map((option) => {
          const isSelected = selectedOption === option.id;

          return (
            <div key={option.id}>
              <button
                onClick={() => handleOptionClick(option)}
                disabled={loading}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left",
                  "transition-colors",
                  useLiquidGlass
                    ? "hover:bg-white/10"
                    : "hover:bg-black/5 dark:hover:bg-white/5",
                  option.destructive && "hover:bg-red-500/10",
                  isSelected && (useLiquidGlass ? "bg-white/10" : "bg-primary/10"),
                  loading && "opacity-50 cursor-wait"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 mt-0.5",
                    option.destructive
                      ? "text-red-500"
                      : isSelected
                      ? "text-primary"
                      : "text-muted-foreground/70"
                  )}
                >
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-[13px] font-medium",
                      option.destructive && "text-red-500",
                      isSelected && !option.destructive && "text-primary"
                    )}
                  >
                    {option.label}
                  </div>
                  <div className="text-[12px] text-muted-foreground/60">
                    {option.description}
                  </div>
                </div>
                {option.hasInput && (
                  <div
                    className={cn(
                      "shrink-0 w-4 h-4 rounded-full border-2 mt-0.5",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                )}
              </button>

              {/* Expandable input section */}
              {option.hasInput && isSelected && (
                <div className="px-3 pb-3">
                  <div className="ml-7 space-y-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => onInputChange(e.target.value)}
                      placeholder={option.inputPlaceholder}
                      className={cn(
                        "w-full px-3 py-2 text-[13px] rounded-lg",
                        "bg-black/5 dark:bg-white/5",
                        "border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50",
                        "placeholder:text-muted-foreground/50"
                      )}
                      autoFocus
                    />
                    <button
                      onClick={handleConfirmWithInput}
                      disabled={loading}
                      className={cn(
                        "w-full px-3 py-2 text-[13px] rounded-lg",
                        "bg-primary text-primary-foreground",
                        "hover:bg-primary/90 transition-colors",
                        "flex items-center justify-center gap-2",
                        loading && "opacity-50 cursor-wait"
                      )}
                    >
                      {loading && (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      )}
                      Stash and Switch
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DialogFooterProps {
  useLiquidGlass: boolean;
}

function DialogFooter({ useLiquidGlass }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2",
        useLiquidGlass
          ? "border-t border-white/10"
          : "border-t border-black/5 dark:border-white/5"
      )}
    >
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
            ↑↓
          </kbd>{" "}
          Navigate
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
            ↵
          </kbd>{" "}
          Select
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
            esc
          </kbd>{" "}
          Close
        </span>
      </div>
    </div>
  );
}
