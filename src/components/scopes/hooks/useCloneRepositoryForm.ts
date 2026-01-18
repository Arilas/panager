import { useState, useEffect, useRef, useCallback } from "react";
import {
  parseGitUrl,
  cloneRepository,
  onCloneProgress,
  checkFolderExists,
} from "../../../lib/tauri";
import { useScopesStore } from "../../../stores/scopes";
import { useSettingsStore } from "../../../stores/settings";
import { useSshStore } from "../../../stores/ssh";
import type {
  ScopeWithLinks,
  ParsedGitUrl,
  CloneProgress,
  CloneOptions,
} from "../../../types";

interface UseCloneRepositoryFormProps {
  scope: ScopeWithLinks;
  open: boolean;
  onCloned?: (projectId: string) => void;
}

export function useCloneRepositoryForm({
  scope,
  open,
  onCloned,
}: UseCloneRepositoryFormProps) {
  // Form state
  const [url, setUrl] = useState("");
  const [parsedUrl, setParsedUrl] = useState<ParsedGitUrl | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderExists, setFolderExists] = useState(false);

  // SSH alias options
  const [useSshAlias, setUseSshAlias] = useState(false);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [branch, setBranch] = useState("");
  const [shallow, setShallow] = useState(false);

  // Clone progress state
  const [cloning, setCloning] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  const { fetchScopes } = useScopesStore();
  const { settings } = useSettingsStore();
  const { aliases, fetchAliases } = useSshStore();

  // Fetch SSH aliases when dialog opens
  useEffect(() => {
    if (open && settings.max_ssh_integration) {
      fetchAliases();
    }
  }, [open, settings.max_ssh_integration, fetchAliases]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setUrl("");
      setParsedUrl(null);
      setParseError(null);
      setFolderName("");
      setFolderExists(false);
      setUseSshAlias(false);
      setShowAdvanced(false);
      setBranch("");
      setShallow(false);
      setCloning(false);
      setStatus("");
      setProgress([]);
      setShowLog(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  // Parse URL when it changes
  useEffect(() => {
    const parseUrl = async () => {
      if (!url.trim()) {
        setParsedUrl(null);
        setParseError(null);
        setFolderName("");
        return;
      }

      try {
        const knownAliases = aliases.map((a) => a.host);
        const parsed = await parseGitUrl(url.trim(), knownAliases);
        setParsedUrl(parsed);
        setParseError(null);

        // Auto-fill folder name from repo
        if (!folderName || folderName === parsedUrl?.repo) {
          setFolderName(parsed.repo);
        }

        // Auto-check "use alias" if scope has alias and URL is HTTP or standard SSH
        if (
          scope.scope.sshAlias &&
          !parsed.usesAlias &&
          !parsed.hasHttpCredentials
        ) {
          setUseSshAlias(true);
        }
      } catch {
        setParsedUrl(null);
        setParseError("Could not parse URL. Please enter a valid git URL.");
      }
    };

    const debounce = setTimeout(parseUrl, 300);
    return () => clearTimeout(debounce);
  }, [url, aliases, scope.scope.sshAlias, folderName, parsedUrl?.repo]);

  // Check if folder exists in scope's default folder
  useEffect(() => {
    if (!folderName.trim() || !scope.scope.defaultFolder) {
      setFolderExists(false);
      return;
    }

    const checkExists = async () => {
      try {
        const exists = await checkFolderExists(
          scope.scope.id,
          folderName.trim()
        );
        setFolderExists(exists);
      } catch {
        setFolderExists(false);
      }
    };

    const debounce = setTimeout(checkExists, 300);
    return () => clearTimeout(debounce);
  }, [folderName, scope.scope.id, scope.scope.defaultFolder]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress]);

  const handleClone = useCallback(async () => {
    if (!parsedUrl || !folderName.trim()) return;

    setCloning(true);
    setError(null);
    setSuccess(false);
    setProgress([]);
    setShowLog(true);
    setStatus("Starting clone...");

    // Subscribe to progress events
    const unlisten = await onCloneProgress((progressEvent: CloneProgress) => {
      setProgress((prev) => [...prev, progressEvent.line]);
      if (progressEvent.status) {
        setStatus(progressEvent.status);
      }
      if (progressEvent.isError) {
        setError(progressEvent.line);
      }
    });

    try {
      const options: CloneOptions = {
        useSshAlias:
          useSshAlias && scope.scope.sshAlias ? scope.scope.sshAlias : null,
        branch: branch.trim() || null,
        shallow,
      };

      const result = await cloneRepository(
        scope.scope.id,
        url.trim(),
        folderName.trim(),
        options
      );

      if (result.success) {
        setSuccess(true);
        setStatus("Complete");
        await fetchScopes();
        if (result.projectId && onCloned) {
          onCloned(result.projectId);
        }
      } else {
        setError(result.error || "Clone failed");
        setStatus("Failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
      setStatus("Failed");
    } finally {
      unlisten();
      setCloning(false);
    }
  }, [
    parsedUrl,
    folderName,
    useSshAlias,
    scope.scope.sshAlias,
    scope.scope.id,
    url,
    branch,
    shallow,
    fetchScopes,
    onCloned,
  ]);

  // Determine if we should show SSH alias options
  const showSshOptions =
    settings.max_ssh_integration &&
    scope.scope.sshAlias &&
    parsedUrl &&
    !parsedUrl.hasHttpCredentials &&
    parsedUrl.usesAlias !== scope.scope.sshAlias;

  const canClone =
    parsedUrl &&
    folderName.trim() &&
    !cloning &&
    !parsedUrl.hasHttpCredentials &&
    !folderExists;

  return {
    // Form state
    url,
    setUrl,
    parsedUrl,
    parseError,
    folderName,
    setFolderName,
    folderExists,

    // SSH options
    useSshAlias,
    setUseSshAlias,
    showSshOptions,

    // Advanced options
    showAdvanced,
    setShowAdvanced,
    branch,
    setBranch,
    shallow,
    setShallow,

    // Clone progress
    cloning,
    status,
    progress,
    showLog,
    setShowLog,
    error,
    success,
    logRef,

    // Actions
    handleClone,
    canClone,
  };
}
