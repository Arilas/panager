import { create } from "zustand";
import type {
  DiagnosticIssue,
  DiagnosticFix,
  DisabledRule,
  RuleMetadata,
  ScanState,
  ScopeDiagnosticsSummary,
  Severity,
} from "../types";
import * as api from "../lib/tauri";

interface DiagnosticsState {
  issues: Map<string, DiagnosticIssue[]>;
  summaries: Map<string, ScopeDiagnosticsSummary>;
  scanStates: Map<string, ScanState>;
  disabledRules: DisabledRule[];
  ruleMetadata: RuleMetadata[];
  loading: boolean;
  scanning: Set<string>;
  error: string | null;

  fetchScopeDiagnostics: (scopeId: string, includeDismissed?: boolean) => Promise<void>;
  fetchAllSummaries: () => Promise<void>;
  fetchScopeSummary: (scopeId: string) => Promise<void>;
  fetchDisabledRules: () => Promise<void>;
  fetchRuleMetadata: () => Promise<void>;
  scanScope: (scopeId: string) => Promise<void>;
  dismissIssue: (issueId: string, scopeId: string) => Promise<void>;
  undismissIssue: (issueId: string, scopeId: string) => Promise<void>;
  fixIssue: (fix: DiagnosticFix, scopeId: string) => Promise<void>;
  disableRule: (ruleId: string, scopeId?: string) => Promise<void>;
  enableRule: (ruleId: string, scopeId?: string) => Promise<void>;

  getScopeIssues: (scopeId: string) => DiagnosticIssue[];
  getScopeSummary: (scopeId: string) => ScopeDiagnosticsSummary | undefined;
  getScopeScanState: (scopeId: string) => ScanState | undefined;
  isRuleDisabled: (ruleId: string, scopeId?: string) => boolean;
  isScopeScanning: (scopeId: string) => boolean;
  getIssuesByGroup: (scopeId: string) => Map<string, DiagnosticIssue[]>;
  getIssuesBySeverity: (scopeId: string, severity: Severity) => DiagnosticIssue[];
  getRuleMetadataById: (ruleId: string) => RuleMetadata | undefined;

  handleDiagnosticsUpdated: (scopeId: string) => void;
  handleDiagnosticsCleared: (scopeId: string, ruleId: string | null) => void;
}

function updateMapEntry<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

function updateIssues(
  issues: Map<string, DiagnosticIssue[]>,
  scopeId: string,
  updater: (issues: DiagnosticIssue[]) => DiagnosticIssue[]
): Map<string, DiagnosticIssue[]> {
  const newIssues = new Map(issues);
  const scopeIssues = newIssues.get(scopeId) ?? [];
  newIssues.set(scopeId, updater(scopeIssues));
  return newIssues;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  issues: new Map(),
  summaries: new Map(),
  scanStates: new Map(),
  disabledRules: [],
  ruleMetadata: [],
  loading: false,
  scanning: new Set(),
  error: null,

  fetchScopeDiagnostics: async (scopeId, includeDismissed = false) => {
    set({ loading: true, error: null });
    try {
      const issues = await api.getScopeDiagnostics(scopeId, includeDismissed);
      set((state) => ({
        issues: updateMapEntry(state.issues, scopeId, issues),
        loading: false,
      }));
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchAllSummaries: async () => {
    set({ loading: true, error: null });
    try {
      const summaries = await api.getDiagnosticsSummaries();
      set((state) => {
        const newSummaries = new Map(state.summaries);
        for (const summary of summaries) {
          newSummaries.set(summary.scopeId, summary);
        }
        return { summaries: newSummaries, loading: false };
      });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchScopeSummary: async (scopeId) => {
    try {
      const summary = await api.getScopeDiagnosticsSummary(scopeId);
      set((state) => ({
        summaries: updateMapEntry(state.summaries, scopeId, summary),
      }));
    } catch (error) {
      console.error("Failed to fetch scope summary:", error);
    }
  },

  fetchDisabledRules: async () => {
    try {
      const disabledRules = await api.getDisabledDiagnosticRules();
      set({ disabledRules });
    } catch (error) {
      console.error("Failed to fetch disabled rules:", error);
    }
  },

  fetchRuleMetadata: async () => {
    try {
      const ruleMetadata = await api.getDiagnosticRuleMetadata();
      set({ ruleMetadata });
    } catch (error) {
      console.error("Failed to fetch rule metadata:", error);
    }
  },

  scanScope: async (scopeId) => {
    set((state) => ({
      scanning: new Set(state.scanning).add(scopeId),
      error: null,
    }));

    try {
      const scanState = await api.scanScopeDiagnostics(scopeId);

      set((state) => {
        const newScanning = new Set(state.scanning);
        newScanning.delete(scopeId);
        return {
          scanStates: updateMapEntry(state.scanStates, scopeId, scanState),
          scanning: newScanning,
        };
      });

      await get().fetchScopeDiagnostics(scopeId);
      await get().fetchScopeSummary(scopeId);
    } catch (error) {
      set((state) => {
        const newScanning = new Set(state.scanning);
        newScanning.delete(scopeId);
        return { error: String(error), scanning: newScanning };
      });
    }
  },

  dismissIssue: async (issueId, scopeId) => {
    try {
      await api.dismissDiagnostic(issueId);
      set((state) => ({
        issues: updateIssues(state.issues, scopeId, (issues) =>
          issues.map((issue) =>
            issue.id === issueId ? { ...issue, dismissed: true } : issue
          )
        ),
      }));
      await get().fetchScopeSummary(scopeId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  undismissIssue: async (issueId, scopeId) => {
    try {
      await api.undismissDiagnostic(issueId);
      set((state) => ({
        issues: updateIssues(state.issues, scopeId, (issues) =>
          issues.map((issue) =>
            issue.id === issueId ? { ...issue, dismissed: false } : issue
          )
        ),
      }));
      await get().fetchScopeSummary(scopeId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  fixIssue: async (fix, scopeId) => {
    try {
      await api.fixDiagnosticIssue(fix);
      await get().fetchScopeDiagnostics(scopeId);
      await get().fetchScopeSummary(scopeId);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  disableRule: async (ruleId, scopeId) => {
    try {
      await api.disableDiagnosticRule(ruleId, scopeId);
      await get().fetchDisabledRules();
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  enableRule: async (ruleId, scopeId) => {
    try {
      await api.enableDiagnosticRule(ruleId, scopeId);
      await get().fetchDisabledRules();
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getScopeIssues: (scopeId) => get().issues.get(scopeId) ?? [],

  getScopeSummary: (scopeId) => get().summaries.get(scopeId),

  getScopeScanState: (scopeId) => get().scanStates.get(scopeId),

  isRuleDisabled: (ruleId, scopeId) => {
    return get().disabledRules.some(
      (rule) => rule.ruleId === ruleId && (rule.scopeId === null || rule.scopeId === scopeId)
    );
  },

  isScopeScanning: (scopeId) => get().scanning.has(scopeId),

  getIssuesByGroup: (scopeId) => {
    const issues = get().getScopeIssues(scopeId);
    const grouped = new Map<string, DiagnosticIssue[]>();

    for (const issue of issues) {
      if (issue.dismissed) continue;
      const group = issue.ruleId.split("/")[0] || "other";
      const groupIssues = grouped.get(group);
      if (groupIssues) {
        groupIssues.push(issue);
      } else {
        grouped.set(group, [issue]);
      }
    }

    return grouped;
  },

  getIssuesBySeverity: (scopeId, severity) => {
    return get()
      .getScopeIssues(scopeId)
      .filter((issue) => issue.severity === severity && !issue.dismissed);
  },

  getRuleMetadataById: (ruleId) => get().ruleMetadata.find((rule) => rule.id === ruleId),

  handleDiagnosticsUpdated: (scopeId) => {
    get().fetchScopeDiagnostics(scopeId);
    get().fetchScopeSummary(scopeId);
  },

  handleDiagnosticsCleared: (scopeId, ruleId) => {
    if (ruleId) {
      set((state) => ({
        issues: updateIssues(state.issues, scopeId, (issues) =>
          issues.filter((issue) => issue.ruleId !== ruleId)
        ),
      }));
    } else {
      set((state) => {
        const newIssues = new Map(state.issues);
        newIssues.delete(scopeId);
        return { issues: newIssues };
      });
    }
    get().fetchScopeSummary(scopeId);
  },
}));
